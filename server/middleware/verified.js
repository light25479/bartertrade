// Admins are exempt so they can never lock themselves out
function requireEmailVerified(req, res, next) {
  if (req.user.role === 'admin' || req.user.email_verified) return next();
  res.status(403).json({
    error: 'Please verify your email first. Check your inbox, or open the Verify page.',
    code: 'EMAIL_NOT_VERIFIED',
  });
}

function requirePhoneVerified(req, res, next) {
  if (process.env.REQUIRE_PHONE_VERIFICATION === 'false') return next();
  if (req.user.role === 'admin' || req.user.phone_verified) return next();
  res.status(403).json({
    error: 'Please verify your phone number first. You can do this on the Verify page.',
    code: 'PHONE_NOT_VERIFIED',
  });
}

module.exports = { requireEmailVerified, requirePhoneVerified };