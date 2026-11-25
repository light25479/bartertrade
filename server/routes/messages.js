const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { isSuspiciousMessage } = require('../fraud');
const { addClient, removeClient, pushTo } = require('../realtime');
const { requireEmailVerified } = require('../middleware/verified');
const router = express.Router();
router.use(requireAuth);
router.use(
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 120,
    message: { error: 'Too many requests. Please slow down.' },
  })
);

const uuid = z.string().uuid();

const sendSchema = z.object({
  listing_id: uuid,
  other_user_id: uuid.optional(),
  body: z.string().trim().min(1, 'Message cannot be empty').max(1000, 'Message is too long'),
});
// ---------- Live updates (Server-Sent Events) ----------
router.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  addClient(req.user.id, res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(ping);
    removeClient(req.user.id, res);
  });
});
// ---------- Send a message ----------
router.post('/', requireEmailVerified, async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { listing_id, other_user_id, body } = parsed.data;
  const me = req.user.id;

  try {
    const lr = await pool.query(
      "SELECT id, user_id FROM listings WHERE id = $1 AND status IN ('active','traded')",
      [listing_id]
    );
    const listing = lr.rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const isOwner = listing.user_id === me;
    let recipientId;

    if (isOwner) {
      // Sellers can only reply to people who already contacted them about this item
      if (!other_user_id || other_user_id === me) return res.status(400).json({ error: 'Invalid recipient' });
      const prior = await pool.query(
        `SELECT 1 FROM messages WHERE listing_id = $1 AND sender_id = $2 AND recipient_id = $3
         UNION ALL
         SELECT 1 FROM offers WHERE listing_id = $1 AND buyer_id = $2
         LIMIT 1`,
        [listing_id, other_user_id, me]
      );
      if (!prior.rows[0]) return res.status(403).json({ error: 'You can only reply to people who contacted you' });
      recipientId = other_user_id;
    } else {
      recipientId = listing.user_id;
    }

    const rcpt = await pool.query("SELECT 1 FROM users WHERE id = $1 AND status = 'active'", [recipientId]);
    if (!rcpt.rows[0]) return res.status(400).json({ error: 'This user is unavailable' });

    // Hourly cap for everyone
    const hourly = await pool.query(
      "SELECT COUNT(*)::int AS n FROM messages WHERE sender_id = $1 AND created_at > now() - interval '1 hour'",
      [me]
    );
    if (hourly.rows[0].n >= 30) {
      return res.status(429).json({ error: 'You are sending messages too quickly. Try again later.' });
    }

    // Starting new conversations is capped, and lower for brand-new accounts
    if (!isOwner) {
      const existing = await pool.query(
        'SELECT 1 FROM messages WHERE listing_id = $1 AND sender_id = $2 AND recipient_id = $3 LIMIT 1',
        [listing_id, me, recipientId]
      );
      if (!existing.rows[0]) {
        const cap = await pool.query(
          `SELECT
             (SELECT COUNT(DISTINCT listing_id) FROM messages
               WHERE sender_id = $1 AND created_at > now() - interval '24 hours' AND listing_id IS NOT NULL)::int AS started,
             (u.created_at > now() - interval '24 hours') AS is_new
           FROM users u WHERE u.id = $1`,
          [me]
        );
        const { started, is_new } = cap.rows[0];
        const limit = is_new ? 5 : 20;
        if (started >= limit) {
          return res.status(429).json({
            error: is_new
              ? 'New accounts can contact up to 5 sellers in the first 24 hours.'
              : 'You have reached today\'s limit for contacting new sellers.',
          });
        }
      }
    }

    const flagged = isSuspiciousMessage(body);
    const ins = await pool.query(
      `INSERT INTO messages (listing_id, sender_id, recipient_id, body, flagged)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [listing_id, me, recipientId, body, flagged]
    );

    res.status(201).json({
      message: ins.rows[0],
      warning: flagged
        ? 'Your message mentions contact details, links or payment. Stay careful: never pay in advance, and keep the conversation on BarterTrade.'
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- Unread count (navbar badge) ----------
router.get('/unread-count', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM messages WHERE recipient_id = $1 AND read_at IS NULL',
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- Inbox ----------
router.get('/inbox', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (c.listing_id, c.other_id)
           c.listing_id, c.other_id, c.body, c.created_at, c.sender_id,
           l.title AS listing_title, u.name AS other_name,
           (SELECT COUNT(*)::int FROM messages x
              WHERE x.listing_id = c.listing_id AND x.sender_id = c.other_id
                AND x.recipient_id = $1 AND x.read_at IS NULL) AS unread
         FROM (
           SELECT m.listing_id, m.body, m.created_at, m.sender_id,
                  CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END AS other_id
           FROM messages m
           WHERE (m.sender_id = $1 OR m.recipient_id = $1) AND m.listing_id IS NOT NULL
         ) c
         JOIN listings l ON l.id = c.listing_id
         JOIN users u ON u.id = c.other_id
         ORDER BY c.listing_id, c.other_id, c.created_at DESC
       ) t
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ conversations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- One conversation ----------
router.get('/thread', async (req, res) => {
  const parsed = z.object({ listing_id: uuid, other_id: uuid }).safeParse(req.query);
  if (!parsed.success) return res.status(404).json({ error: 'Conversation not found' });
  const { listing_id, other_id } = parsed.data;
  const me = req.user.id;

  try {
    const lr = await pool.query('SELECT id, user_id, title, status FROM listings WHERE id = $1', [listing_id]);
    const listing = lr.rows[0];
    if (!listing || other_id === me) return res.status(404).json({ error: 'Conversation not found' });

    // One of the two people must be the listing owner
    const iAmOwner = listing.user_id === me;
    if (!iAmOwner && listing.user_id !== other_id) return res.status(404).json({ error: 'Conversation not found' });

    const ur = await pool.query('SELECT id, name FROM users WHERE id = $1', [other_id]);
    if (!ur.rows[0]) return res.status(404).json({ error: 'Conversation not found' });

    const msgs = await pool.query(
      `SELECT id, sender_id, body, flagged, created_at FROM messages
       WHERE listing_id = $1
         AND ((sender_id = $2 AND recipient_id = $3) OR (sender_id = $3 AND recipient_id = $2))
       ORDER BY created_at ASC LIMIT 300`,
      [listing_id, me, other_id]
    );

    await pool.query(
      `UPDATE messages SET read_at = now()
       WHERE listing_id = $1 AND sender_id = $2 AND recipient_id = $3 AND read_at IS NULL`,
      [listing_id, other_id, me]
    );

    const buyerId = iAmOwner ? other_id : me;
    const offers = await pool.query(
      `SELECT o.id, o.offered_item, o.offered_price_kes, o.message, o.status, o.created_at,
              EXISTS (SELECT 1 FROM reviews r WHERE r.offer_id = o.id AND r.reviewer_id = $3) AS reviewed
       FROM offers o WHERE o.listing_id = $1 AND o.buyer_id = $2 ORDER BY o.created_at ASC`,
      [listing_id, buyerId, me]
    );

    res.json({
      listing: { id: listing.id, title: listing.title, status: listing.status },
      other: ur.rows[0],
      iAmOwner,
      messages: msgs.rows,
      offers: offers.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;