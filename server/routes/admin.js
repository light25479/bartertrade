const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const uuid = z.string().uuid();
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

async function logAction(adminId, action, targetType, targetId) {
  await pool.query(
    'INSERT INTO admin_actions (admin_id, action, target_type, target_id) VALUES ($1,$2,$3,$4)',
    [adminId, action, targetType, targetId]
  );
}

// ---------- Overview numbers ----------
router.get('/stats', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM users) AS users,
       (SELECT COUNT(*)::int FROM listings WHERE status = 'active') AS active_listings,
       (SELECT COUNT(*)::int FROM listings WHERE status = 'pending_review') AS pending_listings,
       (SELECT COUNT(*)::int FROM reports WHERE status = 'open') AS open_reports`
  );
  res.json(rows[0]);
}));

// ---------- Listings held for review ----------
router.get('/listings/pending', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.description, l.category, l.listing_type, l.price_kes,
            l.wanted_in_exchange, l.created_at,
            u.id AS seller_id, u.name AS seller_name, u.email AS seller_email, u.created_at AS seller_joined,
            COALESCE((SELECT json_agg(url ORDER BY position) FROM listing_images i WHERE i.listing_id = l.id), '[]') AS images
     FROM listings l JOIN users u ON u.id = l.user_id
     WHERE l.status = 'pending_review'
     ORDER BY l.created_at ASC LIMIT 50`
  );
  res.json({ listings: rows });
}));

// Approve (pending_review -> active) or remove
router.patch('/listings/:id/status', wrap(async (req, res) => {
  const idOk = uuid.safeParse(req.params.id).success;
  const parsed = z.object({ status: z.enum(['active', 'removed']) }).safeParse(req.body);
  if (!idOk || !parsed.success) return res.status(400).json({ error: 'Invalid request' });
  const { status } = parsed.data;

  const allowedFrom = status === 'active' ? ['pending_review'] : ['active', 'pending_review', 'traded'];
  const r = await pool.query('UPDATE listings SET status = $1 WHERE id = $2 AND status = ANY($3)', [
    status, req.params.id, allowedFrom,
  ]);
  if (!r.rowCount) return res.status(409).json({ error: 'Listing not found or already handled' });

  // Close out reports on this listing so a re-approved item is not instantly hidden again
  await pool.query("UPDATE reports SET status = $1 WHERE listing_id = $2 AND status = 'open'", [
    status === 'active' ? 'dismissed' : 'resolved', req.params.id,
  ]);
  await logAction(req.user.id, status === 'active' ? 'approve_listing' : 'remove_listing', 'listing', req.params.id);
  res.json({ ok: true });
}));

// ---------- Reports ----------
router.get('/reports', wrap(async (req, res) => {
  const status = z.enum(['open', 'resolved', 'dismissed']).catch('open').parse(req.query.status);
  const { rows } = await pool.query(
    `SELECT r.id, r.reason, r.details, r.status, r.created_at,
            r.listing_id, l.title AS listing_title, l.status AS listing_status,
            r.reported_user_id, ru.name AS reported_user_name,
            l.user_id AS seller_id, su.name AS seller_name,
            rp.name AS reporter_name
     FROM reports r
     JOIN users rp ON rp.id = r.reporter_id
     LEFT JOIN listings l ON l.id = r.listing_id
     LEFT JOIN users ru ON ru.id = r.reported_user_id
     LEFT JOIN users su ON su.id = l.user_id
     WHERE r.status = $1
     ORDER BY r.created_at DESC LIMIT 100`,
    [status]
  );
  res.json({ reports: rows });
}));

router.patch('/reports/:id', wrap(async (req, res) => {
  const idOk = uuid.safeParse(req.params.id).success;
  const parsed = z.object({ status: z.enum(['resolved', 'dismissed']) }).safeParse(req.body);
  if (!idOk || !parsed.success) return res.status(400).json({ error: 'Invalid request' });

  const r = await pool.query("UPDATE reports SET status = $1 WHERE id = $2 AND status = 'open'", [
    parsed.data.status, req.params.id,
  ]);
  if (!r.rowCount) return res.status(409).json({ error: 'Report not found or already handled' });
  await logAction(req.user.id, `report_${parsed.data.status}`, 'report', req.params.id);
  res.json({ ok: true });
}));

// ---------- Users ----------
router.get('/users', wrap(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.county, u.role, u.status, u.created_at,
            (SELECT COUNT(*)::int FROM listings l WHERE l.user_id = u.id AND l.status <> 'removed') AS listings,
            (SELECT COUNT(*)::int FROM reports r
              WHERE r.status = 'open'
                AND (r.reported_user_id = u.id OR r.listing_id IN (SELECT id FROM listings WHERE user_id = u.id))) AS open_reports
     FROM users u
     WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1)
     ORDER BY u.created_at DESC LIMIT 50`,
    [search ? `%${escapeLike(search)}%` : null]
  );
  res.json({ users: rows });
}));

router.patch('/users/:id/status', wrap(async (req, res) => {
  const idOk = uuid.safeParse(req.params.id).success;
  const parsed = z.object({ status: z.enum(['active', 'suspended']) }).safeParse(req.body);
  if (!idOk || !parsed.success) return res.status(400).json({ error: 'Invalid request' });

  const t = await pool.query('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
  if (!t.rows[0]) return res.status(404).json({ error: 'User not found' });
  if (t.rows[0].role === 'admin' || t.rows[0].id === req.user.id) {
    return res.status(400).json({ error: 'Admin accounts cannot be changed here' });
  }

  await pool.query('UPDATE users SET status = $1 WHERE id = $2', [parsed.data.status, req.params.id]);
  await logAction(req.user.id, parsed.data.status === 'suspended' ? 'suspend_user' : 'reactivate_user', 'user', req.params.id);
  res.json({ ok: true });
}));
// ---------- Delete an abusive review ----------
router.delete('/reviews/:id', wrap(async (req, res) => {
  if (!uuid.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid request' });
  const r = await pool.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Review not found' });
  await logAction(req.user.id, 'delete_review', 'review', req.params.id);
  res.json({ ok: true });
}));
module.exports = router;