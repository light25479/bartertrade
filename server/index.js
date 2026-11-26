require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const checkOrigin = require('./middleware/origin');
const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const messageRoutes = require('./routes/messages');
const offerRoutes = require('./routes/offers');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const verifyRoutes = require('./routes/verify');
const reviewRoutes = require('./routes/reviews');
const { renderPage } = require('./preview');

const isProd = process.env.NODE_ENV === 'production';

// Refuse to start with missing or weak configuration
const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing settings: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is too short (use at least 32 random characters).');
  process.exit(1);
}
if (isProd && !process.env.CLIENT_URL) {
  console.error('CLIENT_URL must be set in production (your website address).');
  process.exit(1);
}

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.disable('x-powered-by');
if (isProd) app.set('trust proxy', 1); // behind Render's proxy, so rate limits see real visitor IPs

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(checkOrigin);
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/reviews', reviewRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// In production, this same server also delivers the React website
const distDir = path.join(__dirname, '..', 'client', 'dist');
if (isProd && fs.existsSync(distDir)) {
  app.use('/assets', express.static(path.join(distDir, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(distDir, { index: false }));

  const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const hasDefaultImage = fs.existsSync(path.join(distDir, 'og-default.png'));

  app.use(async (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    try {
      const html = await renderPage(indexHtml, req, { origin: allowedOrigins[0], hasDefaultImage });
      res.set('Cache-Control', 'no-cache');
      res.type('html').send(html);
    } catch (err) {
      next(err);
    }
  });
}

// Never leak internal error details to visitors
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));