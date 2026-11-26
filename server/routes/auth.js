const express = require('express');
const rateLimit = require('express-rate-limit');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const crypto = require('crypto');
const { sendEmailVerification, hmac, issueCode, checkSendLimits } = require('../verification');
const { sendMail } = require('../mailer');
const cloudinary = require('../cloudinary');
const router = express.Router();

// Strict limit on signup/login to slow down password guessing and bot signups
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
});

const signupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/, 'Enter a valid phone number'),
  county: z.string().trim().max(60).optional(),
  password: z.string().min(10, 'Password must be at least 10 characters').max(128),
  accept_terms: z.boolean().refine((v) => v === true, { message: 'You must accept the Terms and Privacy Policy' }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

function setAuthCookie(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
  res.cookie('token', token, {
    httpOnly: true, // JavaScript in the browser cannot read this cookie
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post('/signup', authLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, phone, county, password } = parsed.data;

  try {
    const passwordHash = await argon2.hash(password);
        const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, county, password_hash, terms_accepted_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id, name, email, role`,
      [name, email, phone, county || null, passwordHash]
    );
        sendEmailVerification({ id: rows[0].id, name: rows[0].name, email: rows[0].email }).catch((e) =>
      console.error('Verification email failed:', e.message)
    );
    setAuthCookie(res, rows[0]);
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Makes "unknown email" take as long as "wrong password", so response time reveals nothing
let DUMMY_HASH = null;
argon2.hash('not-a-real-password').then((h) => { DUMMY_HASH = h; });

router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }
  const { email, password } = parsed.data;

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];

    if (user && user.locked_until && user.locked_until > new Date()) {
      return res.status(429).json({
        error: 'Too many failed attempts. Try again in 15 minutes, or reset your password.',
      });
    }

    let ok = false;
    if (user) ok = await argon2.verify(user.password_hash, password);
    else if (DUMMY_HASH) await argon2.verify(DUMMY_HASH, password).catch(() => {});

    if (!user || user.status !== 'active' || !ok) {
      if (user && user.status === 'active') {
        // 5 wrong passwords lock the account for 15 minutes
        await pool.query(
          `UPDATE users SET
             failed_logins = CASE WHEN failed_logins + 1 >= 5 THEN 0 ELSE failed_logins + 1 END,
             locked_until  = CASE WHEN failed_logins + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
           WHERE id = $1`,
          [user.id]
        );
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.failed_logins > 0 || user.locked_until) {
      await pool.query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);
    }

    setAuthCookie(res, user);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: { ...req.user, phone_verification_required: process.env.REQUIRE_PHONE_VERIFICATION !== 'false' },
  });
});
// ---------- Password reset and change ----------
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 5 : 50,
  message: { error: 'Too many requests. Please try again later.' },
});

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password is too long');

function notifyPasswordChanged(user) {
  sendMail({
    to: user.email,
    subject: 'Your BarterTrade password was changed',
    text:
      `Hi ${user.name},\n\nThe password on your BarterTrade account was just changed.\n\n` +
      `If this was you, no action is needed. If it was not you, reset your password immediately ` +
      `from the login page and contact us.`,
  }).catch((e) => console.error('Password notice failed:', e.message));
}

// Step 1: ask for a reset link
router.post('/forgot', resetLimiter, async (req, res) => {
  // The same answer is given whether or not the account exists, so nobody can probe for registered emails
  res.json({
    ok: true,
    message: 'If an account exists for that email, we have sent a link to reset the password.',
  });

  try {
    const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(req.body);
    if (!parsed.success) return;

    const { rows } = await pool.query(
      "SELECT id, name, email FROM users WHERE email = $1 AND status = 'active'",
      [parsed.data.email]
    );
    const user = rows[0];
    if (!user || (await checkSendLimits(user.id, 'reset'))) return;

    const token = crypto.randomBytes(32).toString('hex');
    await issueCode({ userId: user.id, kind: 'reset', code: token, ttlMinutes: 60 });
    const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your BarterTrade password',
      text:
        `Hi ${user.name},\n\nWe received a request to reset your password. ` +
        `Open this link to choose a new one (valid for 1 hour, works once):\n${link}\n\n` +
        `If you did not ask for this, ignore this email. Your password has not changed.`,
    });
  } catch (err) {
    console.error('Forgot-password error:', err.message);
  }
});

// Step 2: choose a new password with the link
router.post('/reset', authLimiter, async (req, res) => {
  const parsed = z
    .object({
      token: z.string().regex(/^[a-f0-9]{64}$/, 'This reset link is not valid'),
      password: passwordSchema,
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { token, password } = parsed.data;

  try {
    // Claim the token in one step so it can only ever be used once
    const claim = await pool.query(
      `UPDATE verification_codes SET expires_at = now()
       WHERE kind = 'reset' AND code_hash = $1 AND expires_at > now()
       RETURNING user_id`,
      [hmac(token)]
    );
    if (!claim.rows[0]) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const hash = await argon2.hash(password);
    const upd = await pool.query(
            `UPDATE users SET password_hash = $1, password_changed_at = $2, email_verified = TRUE,
              failed_logins = 0, locked_until = NULL
       WHERE id = $3 AND status = 'active'
       RETURNING name, email`,
      [hash, new Date(), claim.rows[0].user_id]
    );
    if (upd.rows[0]) notifyPasswordChanged(upd.rows[0]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Change password while logged in
router.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const parsed = z
    .object({ current_password: z.string().min(1).max(128), new_password: passwordSchema })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { current_password, new_password } = parsed.data;

  try {
    const { rows } = await pool.query('SELECT password_hash, name, email FROM users WHERE id = $1', [req.user.id]);
    const me = rows[0];
    if (!(await argon2.verify(me.password_hash, current_password))) {
      return res.status(400).json({ error: 'Your current password is not correct' });
    }
    if (current_password === new_password) {
      return res.status(400).json({ error: 'Please choose a different password' });
    }

    const hash = await argon2.hash(new_password);
    await pool.query('UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3', [
      hash, new Date(), req.user.id,
    ]);
    setAuthCookie(res, req.user); // keeps this device logged in; all others are logged out
    notifyPasswordChanged(me);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});
// Log out every device, including this one's old session
router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET password_changed_at = $1 WHERE id = $2', [new Date(), req.user.id]);
    setAuthCookie(res, req.user); // this device gets a fresh session
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});
// ---------- Download my data ----------
router.get('/export', requireAuth, async (req, res) => {
  const id = req.user.id;
  try {
    const [profile, listings, messages, offers, reviews, reports] = await Promise.all([
      pool.query(
        `SELECT id, name, email, phone, county, role, email_verified, phone_verified, created_at, terms_accepted_at
         FROM users WHERE id = $1`,
        [id]
      ),
      pool.query(
        `SELECT l.id, l.title, l.description, l.category, l.item_condition, l.listing_type, l.price_kes,
                l.wanted_in_exchange, l.county, l.status, l.created_at,
                COALESCE((SELECT json_agg(url ORDER BY position) FROM listing_images i WHERE i.listing_id = l.id), '[]') AS images
         FROM listings l WHERE l.user_id = $1 ORDER BY l.created_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT id, listing_id, sender_id, recipient_id, body, created_at FROM messages
         WHERE sender_id = $1 OR recipient_id = $1 ORDER BY created_at LIMIT 10000`,
        [id]
      ),
      pool.query(
        `SELECT o.id, o.listing_id, o.buyer_id, o.offered_item, o.offered_price_kes, o.message, o.status, o.created_at
         FROM offers o WHERE o.buyer_id = $1 OR o.listing_id IN (SELECT id FROM listings WHERE user_id = $1)`,
        [id]
      ),
      pool.query(
        `SELECT id, offer_id, reviewer_id, reviewee_id, rating, comment, created_at FROM reviews
         WHERE reviewer_id = $1 OR reviewee_id = $1`,
        [id]
      ),
      pool.query(
        `SELECT id, listing_id, reported_user_id, reason, details, status, created_at FROM reports WHERE reporter_id = $1`,
        [id]
      ),
    ]);

    res.json({
      exported_at: new Date().toISOString(),
      profile: profile.rows[0],
      listings: listings.rows,
      messages: messages.rows,
      offers: offers.rows,
      reviews: reviews.rows,
      reports_filed: reports.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- Delete my account ----------
function publicIdFromUrl(url) {
  const m = String(url).match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return m ? m[1] : null;
}

router.delete('/me', requireAuth, authLimiter, async (req, res) => {
  const parsed = z.object({ password: z.string().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please enter your password to confirm' });

  try {
    const { rows } = await pool.query('SELECT password_hash, role FROM users WHERE id = $1', [req.user.id]);
    const me = rows[0];
    if (me.role === 'admin') return res.status(400).json({ error: 'Admin accounts cannot be deleted here' });
    if (!(await argon2.verify(me.password_hash, parsed.data.password))) {
      return res.status(400).json({ error: 'Your password is not correct' });
    }

    const images = await pool.query(
      'SELECT i.url FROM listing_images i JOIN listings l ON l.id = i.listing_id WHERE l.user_id = $1',
      [req.user.id]
    );

    // Listings, offers, messages, reviews, reports and codes are removed automatically with the user
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.clearCookie('token');
    res.json({ ok: true });

    // Remove the photos from Cloudinary afterwards (best effort)
    for (const { url } of images.rows) {
      const publicId = publicIdFromUrl(url);
      if (publicId) cloudinary.uploader.destroy(publicId).catch(() => {});
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Something went wrong' });
  }
});
module.exports = router;