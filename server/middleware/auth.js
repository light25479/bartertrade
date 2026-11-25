const jwt = require('jsonwebtoken');
const pool = require('../db');

// Blocks anyone who isn't logged in. Re-checks the database on every request,
// so a suspended user or a changed password takes effect immediately.
module.exports = async function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const { rows } = await pool.query(
      `SELECT id, name, email, role, status, email_verified, phone_verified, password_changed_at
       FROM users WHERE id = $1`,
      [payload.id]
    );
    const user = rows[0];
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Not logged in' });
    }
    // A password change or reset ends every older session
    if (user.password_changed_at && payload.iat < Math.floor(user.password_changed_at.getTime() / 1000)) {
      return res.status(401).json({ error: 'Not logged in' });
    }
    const { password_changed_at, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch {
    res.status(401).json({ error: 'Not logged in' });
  }
};