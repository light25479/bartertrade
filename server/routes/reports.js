const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const { alertAdmins } = require('../alerts');
const router = express.Router();
router.use(requireAuth);

const uuid = z.string().uuid();

const schema = z
  .object({
    listing_id: uuid.nullish(),
    reported_user_id: uuid.nullish(),
    reason: z.enum(['scam', 'prohibited', 'misleading', 'harassment', 'other']),
    details: z.string().trim().max(1000).optional(),
  })
  .refine((d) => d.listing_id || d.reported_user_id, { message: 'Nothing to report' });

router.post('/', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid report' });
  const { listing_id, reported_user_id, reason, details } = parsed.data;
  const me = req.user.id;

  try {
    const daily = await pool.query(
      "SELECT COUNT(*)::int AS n FROM reports WHERE reporter_id = $1 AND created_at > now() - interval '24 hours'",
      [me]
    );
    if (daily.rows[0].n >= 10) return res.status(429).json({ error: 'You have reached today\'s report limit' });

    let listingOwner = null;
    if (listing_id) {
      const lr = await pool.query('SELECT user_id FROM listings WHERE id = $1', [listing_id]);
      if (!lr.rows[0]) return res.status(404).json({ error: 'Listing not found' });
      listingOwner = lr.rows[0].user_id;
    }
    if (reported_user_id) {
      if (reported_user_id === me) return res.status(400).json({ error: 'You cannot report yourself' });
      const ur = await pool.query('SELECT 1 FROM users WHERE id = $1', [reported_user_id]);
      if (!ur.rows[0]) return res.status(404).json({ error: 'User not found' });
    } else if (listingOwner === me) {
      return res.status(400).json({ error: 'You cannot report your own listing' });
    }

    const dup = await pool.query(
      `SELECT 1 FROM reports
       WHERE reporter_id = $1 AND status = 'open'
         AND listing_id IS NOT DISTINCT FROM $2::uuid
         AND reported_user_id IS NOT DISTINCT FROM $3::uuid`,
      [me, listing_id || null, reported_user_id || null]
    );
    if (dup.rows[0]) return res.status(409).json({ error: 'You already reported this. We are reviewing it.' });

    await pool.query(
      `INSERT INTO reports (reporter_id, listing_id, reported_user_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [me, listing_id || null, reported_user_id || null, reason, details || null]
    );

    // Auto-hide: 3 different people reporting the same listing holds it for review
       alertAdmins(`New report (${reason}) about ${listing_id ? 'a listing' : 'a user'}`);

    // Auto-hide: 3 different people reporting the same listing holds it for review
    if (listing_id) {
      const c = await pool.query(
        "SELECT COUNT(DISTINCT reporter_id)::int AS n FROM reports WHERE listing_id = $1 AND status = 'open'",
        [listing_id]
      );
      if (c.rows[0].n >= 3) {
        const hidden = await pool.query(
          "UPDATE listings SET status = 'pending_review' WHERE id = $1 AND status = 'active'",
          [listing_id]
        );
        if (hidden.rowCount) alertAdmins('A listing was hidden automatically after reports from 3 different people');
      }
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;