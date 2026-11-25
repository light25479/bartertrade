const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { requireEmailVerified, requirePhoneVerified } = require('../middleware/verified');
const { isSuspiciousMessage } = require('../fraud');

const router = express.Router();
const uuid = z.string().uuid();

const createSchema = z.object({
  offer_id: uuid,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

// ---------- Leave a review ----------
router.post('/', requireAuth, requireEmailVerified, requirePhoneVerified, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please choose a rating from 1 to 5' });
  const { offer_id, rating, comment } = parsed.data;
  const me = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT o.id, o.buyer_id, o.status, l.user_id AS owner_id
       FROM offers o JOIN listings l ON l.id = o.listing_id WHERE o.id = $1`,
      [offer_id]
    );
    const o = rows[0];
    if (!o) return res.status(404).json({ error: 'Trade not found' });
    if (o.status !== 'accepted') {
      return res.status(400).json({ error: 'You can only review a trade after an offer was accepted' });
    }
    if (me !== o.buyer_id && me !== o.owner_id) return res.status(403).json({ error: 'Not allowed' });

    const reviewee = me === o.buyer_id ? o.owner_id : o.buyer_id;

    if (comment && isSuspiciousMessage(comment)) {
      return res.status(400).json({ error: 'Please remove phone numbers, links and payment requests from your review.' });
    }

    const recent = await pool.query(
      "SELECT 1 FROM reviews WHERE reviewer_id = $1 AND reviewee_id = $2 AND created_at > now() - interval '30 days'",
      [me, reviewee]
    );
    if (recent.rows[0]) {
      return res.status(429).json({ error: 'You have already reviewed this person recently.' });
    }

    await pool.query(
      `INSERT INTO reviews (offer_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [offer_id, me, reviewee, rating, comment || null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'You already reviewed this trade' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- Public profile: rating, reviews and active listings ----------
router.get('/user/:id', async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) return res.status(404).json({ error: 'User not found' });
  const id = req.params.id;

  try {
    const ur = await pool.query(
      "SELECT id, name, county, created_at, email_verified, phone_verified FROM users WHERE id = $1 AND status = 'active'",
      [id]
    );
    if (!ur.rows[0]) return res.status(404).json({ error: 'User not found' });

    const summary = await pool.query(
      'SELECT COUNT(*)::int AS count, ROUND(AVG(rating)::numeric, 1) AS avg FROM reviews WHERE reviewee_id = $1',
      [id]
    );

    const reviews = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, rv.name AS reviewer_name, l.title AS listing_title
       FROM reviews r
       JOIN users rv ON rv.id = r.reviewer_id
       JOIN offers o ON o.id = r.offer_id
       JOIN listings l ON l.id = o.listing_id
       WHERE r.reviewee_id = $1
       ORDER BY r.created_at DESC LIMIT 30`,
      [id]
    );

    const listings = await pool.query(
      `SELECT l.id, l.title, l.category, l.item_condition, l.listing_type, l.price_kes,
              l.wanted_in_exchange, l.county, l.created_at,
              (SELECT url FROM listing_images i WHERE i.listing_id = l.id ORDER BY position LIMIT 1) AS image_url
       FROM listings l
       WHERE l.user_id = $1 AND l.status = 'active'
       ORDER BY l.created_at DESC LIMIT 12`,
      [id]
    );

    res.json({
      user: ur.rows[0],
      summary: summary.rows[0],
      reviews: reviews.rows,
      listings: listings.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;