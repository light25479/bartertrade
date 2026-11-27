const pool = require('./db');
const { sendMail } = require('./mailer');

const MIN_GAP_MS = 5 * 60 * 1000; // at most one alert email every 5 minutes
let lastSent = 0;
let queue = [];
let timer = null;

// Alerts go to ADMIN_ALERT_EMAIL if you set it, otherwise to every admin account's email
async function recipients() {
  if (process.env.ADMIN_ALERT_EMAIL) {
    return process.env.ADMIN_ALERT_EMAIL.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const { rows } = await pool.query("SELECT email FROM users WHERE role = 'admin' AND status = 'active'");
  return rows.map((r) => r.email);
}

async function flush() {
  timer = null;
  const items = queue;
  queue = [];
  if (items.length === 0) return;
  lastSent = Date.now();

  try {
    const [to, totals] = await Promise.all([
      recipients(),
      pool.query(
        `SELECT (SELECT COUNT(*)::int FROM listings WHERE status = 'pending_review') AS pending,
                (SELECT COUNT(*)::int FROM reports WHERE status = 'open') AS reports`
      ),
    ]);
    const { pending, reports } = totals.rows[0];
    const site = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
    const text =
      `Hi,\n\nBarterTrade needs your attention:\n\n- ${items.join('\n- ')}\n\n` +
      `Waiting right now: ${pending} listing(s) to approve and ${reports} open report(s).\n\n` +
      `Review them here: ${site}/admin`;

    for (const email of to) {
      await sendMail({
        to: email,
        subject: `BarterTrade: ${items.length === 1 ? '1 item needs' : `${items.length} items need`} your review`,
        text,
      });
    }
  } catch (err) {
    console.error('Admin alert failed:', err.message);
  }
}

// Call this whenever something needs an admin. It never throws and never slows the request.
function alertAdmins(message) {
  if (queue.length < 50) queue.push(message);
  if (timer) return;
  const wait = Math.max(0, lastSent + MIN_GAP_MS - Date.now());
  timer = setTimeout(flush, wait);
}

module.exports = { alertAdmins };