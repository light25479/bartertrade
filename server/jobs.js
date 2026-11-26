const pool = require('./db');
const { sendMail } = require('./mailer');

// Hides listings that have passed their 60 days
async function expireListings() {
  const r = await pool.query("UPDATE listings SET status = 'expired' WHERE status = 'active' AND expires_at <= now()");
  if (r.rowCount) console.log(`Expired ${r.rowCount} listing(s)`);
}

// Emails sellers one week before their listing expires
async function sendExpiryReminders() {
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.expires_at, u.email, u.name
     FROM listings l JOIN users u ON u.id = l.user_id
     WHERE l.status = 'active' AND l.expiry_reminded = FALSE
       AND l.expires_at <= now() + interval '7 days' AND u.status = 'active'
     ORDER BY l.expires_at LIMIT 10`
  );

  const site = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  for (const l of rows) {
    try {
      const date = new Date(l.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      await sendMail({
        to: l.email,
        subject: 'Your BarterTrade listing is about to expire',
        text:
          `Hi ${l.name},\n\nYour listing "${l.title}" will expire on ${date}.\n\n` +
          `If it is still available, open My listings and tap Renew to keep it live for another 60 days. ` +
          `If it has been sold or swapped, you can mark it as traded.\n\n${site}/my-listings`,
      });
    } catch (err) {
      console.error('Expiry reminder failed:', err.message);
    }
    // Marked either way, so one bad address can never block the others
    await pool.query('UPDATE listings SET expiry_reminded = TRUE WHERE id = $1', [l.id]);
  }
}

function startJobs() {
  const run = async () => {
    try {
      await expireListings();
      await sendExpiryReminders();
    } catch (err) {
      console.error('Background job error:', err.message);
    }
  };
  setTimeout(run, 15 * 1000); // shortly after the server starts or wakes up
  setInterval(run, 60 * 60 * 1000); // then every hour
}

module.exports = { startJobs };