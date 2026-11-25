// Browsers always attach an Origin header to POST/PATCH/DELETE requests.
// If it names a site that isn't ours, the request is rejected.
const allowed = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = function checkOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !allowed.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};