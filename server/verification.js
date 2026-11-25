const crypto = require('crypto');
const pool = require('./db');
const { sendMail } = require('./mailer');

// Codes are stored as a keyed hash, so a database leak does not reveal them
const hmac = (value) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(value)).digest('hex');

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Turns 0712345678 or 254712345678 into +254712345678. Returns null if invalid.
function normalizePhone(raw) {
  let p = String(raw).replace(/[\s\-().]/g, '');
  if (/^0[17]\d{8}$/.test(p)) p = '+254' + p.slice(1);
  else if (/^254[17]\d{8}$/.test(p)) p = '+' + p;
  return /^\+[1-9]\d{8,14}$/.test(p) ? p : null;
}

// Saves a new code and cancels any earlier unused ones of the same kind
async function issueCode({ userId, kind, code, target, ttlMinutes }) {
  await pool.query(
    'UPDATE verification_codes SET expires_at = now() WHERE user_id = $1 AND kind = $2 AND expires_at > now()',
    [userId, kind]
  );
  await pool.query(
    `INSERT INTO verification_codes (user_id, kind, code_hash, target, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5::int))`,
    [userId, kind, hmac(code), target || null, ttlMinutes]
  );
}

async function sendEmailVerification(user) {
  const token = crypto.randomBytes(32).toString('hex');
  await issueCode({ userId: user.id, kind: 'email', code: token, ttlMinutes: 24 * 60 });
  const link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Verify your BarterTrade email',
    text:
      `Hi ${user.name},\n\n` +
      `Confirm your email address by opening this link (valid for 24 hours):\n${link}\n\n` +
      `If you did not create a BarterTrade account, you can ignore this email.`,
  });
}

// Returns an error message if the user is asking for codes too often, otherwise null
async function checkSendLimits(userId, kind) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS day,
       COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds')::int AS minute
     FROM verification_codes WHERE user_id = $1 AND kind = $2`,
    [userId, kind]
  );
  if (rows[0].minute > 0) return 'Please wait a minute before requesting another.';
  if (rows[0].day >= 5) return 'Too many requests today. Please try again tomorrow.';
  return null;
}

module.exports = { hmac, safeEqual, normalizePhone, issueCode, sendEmailVerification, checkSendLimits };