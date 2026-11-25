const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const pool = require('../db');
const cloudinary = require('../cloudinary');
const requireAuth = require('../middleware/auth');
const { CATEGORIES } = require('../categories');
const { requireEmailVerified, requirePhoneVerified } = require('../middleware/verified');
const router = express.Router();

const PAGE_SIZE = 12;
const MAX_LISTINGS_PER_DAY = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

function uploadImages(req, res, next) {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be under 5 MB'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'You can upload up to 5 photos'
        : 'Invalid upload';
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

// Check the real file contents, not just the name the browser claims
function isRealImage(buf) {
  if (buf.length < 12) return false;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpeg || png || webp;
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'bartertrade',
        resource_type: 'image',
        // Cloudinary re-encodes the image, which strips hidden payloads
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }, { quality: 'auto' }],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Common scam patterns. A match does not block the post; it holds the
// listing for admin review instead.
const SUSPICIOUS = [
  /whats?\s?app/i,
  /telegram/i,
  /western\s?union/i,
  /(send|pay).{0,25}(deposit|upfront|up front|advance|first)/i,
  /(deposit|booking fee|registration fee)/i,
];
const PHONE_PATTERN = /(?:\+?254|0)[17]\d{8}/;

function looksSuspicious(text) {
  if (SUSPICIOUS.some((p) => p.test(text))) return true;
  return PHONE_PATTERN.test(text.replace(/[\s\-().]/g, ''));
}

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');
const uuidSchema = z.string().uuid();

const optionalInt = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().int().min(0).max(100000000).optional()
);

const createSchema = z
  .object({
    title: z.string().trim().min(3, 'Title is too short').max(100),
    description: z.string().trim().min(10, 'Please describe the item (at least 10 characters)').max(2000),
    category: z.enum(CATEGORIES),
    item_condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
    listing_type: z.enum(['sell', 'swap', 'both']),
    price_kes: optionalInt,
    wanted_in_exchange: z.string().trim().max(300).optional(),
    county: z.string().trim().max(60).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.listing_type !== 'swap' && d.price_kes === undefined) {
      ctx.addIssue({ code: 'custom', path: ['price_kes'], message: 'Please enter a price' });
    }
    if (d.listing_type !== 'sell' && !d.wanted_in_exchange) {
      ctx.addIssue({ code: 'custom', path: ['wanted_in_exchange'], message: 'Say what you would like in exchange' });
    }
  });

const browseSchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  type: z.enum(['sell', 'swap']).optional(),
  county: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

// ---------- Browse and search (public) ----------
router.get('/', async (req, res) => {
  const parsed = browseSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid search options' });
  const { search, category, type, county, page } = parsed.data;

  const where = ["l.status = 'active'", "u.status = 'active'"];
  const params = [];

  if (search) {
    params.push(`%${escapeLike(search)}%`);
    where.push(`(l.title ILIKE $${params.length} OR l.description ILIKE $${params.length})`);
  }
  if (category) {
    params.push(category);
    where.push(`l.category = $${params.length}`);
  }
  if (type) {
    params.push(type === 'sell' ? ['sell', 'both'] : ['swap', 'both']);
    where.push(`l.listing_type = ANY($${params.length})`);
  }
  if (county) {
    params.push(`%${escapeLike(county)}%`);
    where.push(`l.county ILIKE $${params.length}`);
  }
  const whereSql = where.join(' AND ');

  try {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM listings l JOIN users u ON u.id = l.user_id WHERE ${whereSql}`,
      params
    );
    const total = countRes.rows[0].total;

    const listRes = await pool.query(
      `SELECT l.id, l.title, l.category, l.item_condition, l.listing_type, l.price_kes,
              l.wanted_in_exchange, l.county, l.created_at,
              (SELECT url FROM listing_images i WHERE i.listing_id = l.id ORDER BY position LIMIT 1) AS image_url,
              u.name AS seller_name
       FROM listings l JOIN users u ON u.id = l.user_id
       WHERE ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
      params
    );

    res.json({ listings: listRes.rows, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- My listings (must come before /:id) ----------
router.get('/mine/all', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.title, l.status, l.listing_type, l.price_kes, l.created_at,
              (SELECT url FROM listing_images i WHERE i.listing_id = l.id ORDER BY position LIMIT 1) AS image_url
       FROM listings l
       WHERE l.user_id = $1 AND l.status <> 'removed'
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json({ listings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- Single listing (public) ----------
router.get('/:id', async (req, res) => {
  if (!uuidSchema.safeParse(req.params.id).success) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.user_id, l.title, l.description, l.category, l.item_condition, l.listing_type,
              l.price_kes, l.wanted_in_exchange, l.county, l.status, l.created_at,
              u.name AS seller_name, u.county AS seller_county, u.created_at AS seller_joined,
                            u.email_verified, u.phone_verified,
              (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE reviewee_id = l.user_id) AS seller_rating,
              (SELECT COUNT(*)::int FROM reviews WHERE reviewee_id = l.user_id) AS seller_reviews
       FROM listings l JOIN users u ON u.id = l.user_id
       WHERE l.id = $1 AND l.status IN ('active', 'traded') AND u.status = 'active'`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Listing not found' });

    const images = await pool.query(
      'SELECT url FROM listing_images WHERE listing_id = $1 ORDER BY position',
      [req.params.id]
    );
    res.json({ listing: rows[0], images: images.rows.map((r) => r.url) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ---------- Create listing ----------
router.post('/', requireAuth, requireEmailVerified, requirePhoneVerified, uploadImages, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;

  const files = req.files || [];
  if (files.length === 0) return res.status(400).json({ error: 'Please add at least one photo' });
  if (!files.every((f) => isRealImage(f.buffer))) {
    return res.status(400).json({ error: 'Only real JPG, PNG or WebP photos are allowed' });
  }

  try {
    // Daily cap slows down spammers and scammers mass-posting
    const recent = await pool.query(
      "SELECT COUNT(*)::int AS n FROM listings WHERE user_id = $1 AND created_at > now() - interval '24 hours'",
      [req.user.id]
    );
    if (recent.rows[0].n >= MAX_LISTINGS_PER_DAY) {
      return res.status(429).json({ error: `You can post up to ${MAX_LISTINGS_PER_DAY} items per day` });
    }

        const flagged = looksSuspicious(`${d.title} ${d.description} ${d.wanted_in_exchange || ''}`);

    // Sellers without a verified phone have their first 2 listings checked by an admin
    let needsReview = false;
    if (!req.user.phone_verified && req.user.role !== 'admin') {
      const approved = await pool.query(
        "SELECT COUNT(*)::int AS n FROM listings WHERE user_id = $1 AND status IN ('active','traded')",
        [req.user.id]
      );
      needsReview = approved.rows[0].n < 2;
    }
    const status = flagged || needsReview ? 'pending_review' : 'active';

    const uploaded = [];
    for (const f of files) uploaded.push(await uploadToCloudinary(f.buffer));

    const client = await pool.connect();
    let listing;
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO listings
           (user_id, title, description, category, item_condition, listing_type,
            price_kes, wanted_in_exchange, county, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, status`,
        [
          req.user.id, d.title, d.description, d.category, d.item_condition, d.listing_type,
          d.listing_type === 'swap' ? null : d.price_kes,
          d.listing_type === 'sell' ? null : d.wanted_in_exchange,
          d.county || null, status,
        ]
      );
      listing = ins.rows[0];
      for (let i = 0; i < uploaded.length; i++) {
        await client.query(
          'INSERT INTO listing_images (listing_id, url, position) VALUES ($1,$2,$3)',
          [listing.id, uploaded[i].secure_url, i]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.status(201).json({
      listing,
            notice: flagged
        ? 'Your listing is being reviewed before it goes live. To keep everyone safe, listings that include phone numbers or payment requests are checked first. Use in-app messages to contact buyers.'
        : needsReview
        ? 'Your listing is waiting for a quick safety review. It will go live as soon as it is approved.'
        : 'Your listing is live!',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create the listing. Please try again.' });
  }
});

// ---------- Mark as traded / remove ----------
router.patch('/:id/status', requireAuth, async (req, res) => {
  const idOk = uuidSchema.safeParse(req.params.id).success;
  const parsed = z.object({ status: z.enum(['traded', 'removed']) }).safeParse(req.body);
  if (!idOk || !parsed.success) return res.status(400).json({ error: 'Invalid request' });

  // A held listing can only be removed, never marked traded (that would make it public)
  const allowedFrom = parsed.data.status === 'traded' ? ['active'] : ['active', 'pending_review', 'traded'];

  try {
    const { rowCount } = await pool.query(
      'UPDATE listings SET status = $1 WHERE id = $2 AND user_id = $3 AND status = ANY($4)',
      [parsed.data.status, req.params.id, req.user.id, allowedFrom]
    );
    if (!rowCount) return res.status(404).json({ error: 'Listing not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;