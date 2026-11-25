const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { sendSms } = require('../sms');
const {
  hmac, safeEqual, normalizePhone, issueCode, sendEmailVerification, checkSendLimits,
} = require('../verification');

const router = express.Router();

const limiter = (max, minutes) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit: max,
    message: { error: 'Too many attempts. Please try again later.' },
  });

// ---------- Public: the link in the email lands here ----------
router.post('/email/confirm', limiter(20, 15), async (req, res) => {
  const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'This link is not valid.' });

  try {
    const { rows } = await pool.query(
      "SELECT id, user_id FROM verification_codes WHERE kind = 'email' AND code_hash = $1 AND expires_at > now()",
      [hmac(parsed.data.token)]
    );
    if (!rows[0]) {
      return res.status(400).json({ error: 'This link is invalid or has expired. Log in and request a new one.' });
    }
    await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [rows[0].user_id]);
    await pool.query('UPDATE verification_codes SET expires_at = now() WHERE id = $1', [rows[0].id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Everything below needs a login
router.use(requireAuth);

// ---------- Email: send again ----------
router.post('/email/send', async (req, res) => {
  if (req.user.email_verified) return res.json({ ok: true });
  try {
    const blocked = await checkSendLimits(req.user.id, 'email');
    if (blocked) return res.status(429).json({ error: blocked });
    await sendEmailVerification(req.user);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not send the email. Please try again later.' });
  }
});

// ---------- Phone: send a code ----------
router.post('/phone/send', limiter(10, 60), async (req, res) => {
  // Email must be verified first, which stops bots from triggering costly SMS messages
  if (!req.user.email_verified) return res.status(403).json({ error: 'Please verify your email first.' });
  if (req.user.phone_verified) return res.status(400).json({ error: 'Your phone is already verified.' });

  const parsed = z.object({ phone: z.string().trim().max(30) }).safeParse(req.body);
  const phone = parsed.success ? normalizePhone(parsed.data.phone) : null;
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number, for example +254712345678' });

  try {
    const taken = await pool.query(
      'SELECT 1 FROM users WHERE phone = $1 AND phone_verified AND id <> $2',
      [phone, req.user.id]
    );
    if (taken.rows[0]) return res.status(409).json({ error: 'This number is already verified on another account.' });

    const blocked = await checkSendLimits(req.user.id, 'phone');
    if (blocked) return res.status(429).json({ error: blocked });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await issueCode({ userId: req.user.id, kind: 'phone', code, target: phone, ttlMinutes: 10 });

    try {
      await sendSms(phone, `Your BarterTrade code is ${code}. It expires in 10 minutes. Never share it with anyone.`);
    } catch (err) {
      console.error(err);
      return res.status(502).json({ error: 'Could not send the SMS. Check the number and try again.' });
    }
    res.json({ ok: true, phone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- Phone: check the code ----------
router.post('/phone/confirm', limiter(30, 60), async (req, res) => {
  const parsed = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter the 6-digit code' });

  try {
    const latest = await pool.query(
      `SELECT id FROM verification_codes
       WHERE user_id = $1 AND kind = 'phone' AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!latest.rows[0]) return res.status(400).json({ error: 'That code has expired. Please request a new one.' });

    // Count the attempt first; after 5 wrong guesses the code is dead
    const att = await pool.query(
      `UPDATE verification_codes SET attempts = attempts + 1
       WHERE id = $1 AND attempts < 5 RETURNING id, code_hash, target`,
      [latest.rows[0].id]
    );
    if (!att.rows[0]) return res.status(429).json({ error: 'Too many wrong attempts. Please request a new code.' });

    const row = att.rows[0];
    if (!safeEqual(hmac(parsed.data.code), row.code_hash)) {
      return res.status(400).json({ error: 'That code is not correct.' });
    }

    try {
      await pool.query('UPDATE users SET phone = $1, phone_verified = TRUE WHERE id = $2', [row.target, req.user.id]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'This number is already verified on another account.' });
      }
      throw err;
    }
    await pool.query('UPDATE verification_codes SET expires_at = now() WHERE id = $1', [row.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;