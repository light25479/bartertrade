const PATTERNS = [
  /whats?\s?app/i,
  /telegram/i,
  /western\s?union/i,
  /(send|pay).{0,25}(deposit|upfront|up front|advance|first)/i,
  /(deposit|booking fee|registration fee|delivery fee|clearance fee)/i,
  /(https?:\/\/|www\.|bit\.ly)/i,
  /(gift ?card|crypto|bitcoin|usdt)/i,
];
const PHONE = /(?:\+?254|0)[17]\d{8}/;

function isSuspiciousMessage(text) {
  if (PATTERNS.some((p) => p.test(text))) return true;
  return PHONE.test(text.replace(/[\s\-().]/g, ''));
}

module.exports = { isSuspiciousMessage };