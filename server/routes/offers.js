const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { pushTo } = require('../realtime');
const { requireEmailVerified } = require('../middleware/verified');
const router = express.Router();
router.use(requireAuth);
router.use(
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 60,
    message: { error: 'Too many requests. Please slow down.' },
  })
);

const uuid = z.string().uuid();

const optionalInt = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().int().min(1).max(100000000).optional()
);

const offerSchema = z
  .object({
    listing_id: uuid,
    offered_item: z.string().trim().max(300).optional(),
    offered_price_kes: optionalInt,
    message: z.string().trim().max(500).optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.offered_item && d.offered_price_kes === undefined) {
      ctx.addIssue({ code: 'custom', path: ['offered_item'], message: 'Offer a price, an item to swap, or both' });
    }
  });

async function notify(senderId, recipientId, listingId, body) {
  await pool.query(
    'INSERT INTO messages (listing_id, sender_id, recipient_id, body) VALUES ($1,$2,$3,$4)',
    [listingId, senderId, recipientId, body]
  );
  pushTo(recipientId, { type: 'message', listing_id: listingId, other_id: senderId });
  pushTo(senderId, { type: 'message', listing_id: listingId, other_id: recipientId });
}

// ---------- Make an offer ----------
router.post('/', requireEmailVerified, async (req, res) => {
  const parsed = offerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;
  const me = req.user.id;

  try {
    const lr = await pool.query(
      "SELECT id, user_id, listing_type FROM listings WHERE id = $1 AND status = 'active'",
      [d.listing_id]
    );
    const listing = lr.rows[0];
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.user_id === me) return res.status(400).json({ error: 'You cannot make an offer on your own item' });
    if (listing.listing_type === 'sell' && d.offered_item) {
      return res.status(400).json({ error: 'This item is for sale only. Offer a price.' });
    }
    if (listing.listing_type === 'swap' && d.offered_price_kes !== undefined) {
      return res.status(400).json({ error: 'This item is for swap only. Offer an item.' });
    }

    const pending = await pool.query(
      "SELECT 1 FROM offers WHERE listing_id = $1 AND buyer_id = $2 AND status = 'pending'",
      [d.listing_id, me]
    );
    if (pending.rows[0]) {
      return res.status(409).json({ error: 'You already have a pending offer on this item. Withdraw it first.' });
    }

    const daily = await pool.query(
      "SELECT COUNT(*)::int AS n FROM offers WHERE buyer_id = $1 AND created_at > now() - interval '24 hours'",
      [me]
    );
    if (daily.rows[0].n >= 10) return res.status(429).json({ error: 'You can make up to 10 offers per day' });

    const { rows } = await pool.query(
      `INSERT INTO offers (listing_id, buyer_id, offered_item, offered_price_kes, message)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [d.listing_id, me, d.offered_item || null, d.offered_price_kes ?? null, d.message || null]
    );

    await notify(me, listing.user_id, d.listing_id, 'Sent you an offer.');
    res.status(201).json({ offer: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- Accept / decline / withdraw ----------
router.patch('/:id', async (req, res) => {
  const idOk = uuid.safeParse(req.params.id).success;
  const parsed = z.object({ action: z.enum(['accept', 'decline', 'withdraw']) }).safeParse(req.body);
  if (!idOk || !parsed.success) return res.status(400).json({ error: 'Invalid request' });
  const { action } = parsed.data;
  const me = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.listing_id, o.buyer_id, o.status, l.user_id AS owner_id, l.status AS listing_status
       FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.id = $1`,
      [req.params.id]
    );
    const o = rows[0];
    if (!o) return res.status(404).json({ error: 'Offer not found' });
    if (o.status !== 'pending') return res.status(409).json({ error: 'This offer is no longer pending' });

    if (action === 'withdraw') {
      if (me !== o.buyer_id) return res.status(403).json({ error: 'Not allowed' });
    } else {
      if (me !== o.owner_id) return res.status(403).json({ error: 'Not allowed' });
      if (o.listing_status !== 'active') return res.status(409).json({ error: 'This listing is no longer active' });
    }

    const newStatus = { accept: 'accepted', decline: 'declined', withdraw: 'withdrawn' }[action];
    const upd = await pool.query("UPDATE offers SET status = $1 WHERE id = $2 AND status = 'pending'", [newStatus, o.id]);
    if (!upd.rowCount) return res.status(409).json({ error: 'This offer is no longer pending' });

    const recipient = action === 'withdraw' ? o.owner_id : o.buyer_id;
    const text = { accept: 'Accepted your offer.', decline: 'Declined your offer.', withdraw: 'Withdrew their offer.' }[action];
    await notify(me, recipient, o.listing_id, text);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;