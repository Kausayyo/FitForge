// Simple in-memory rate limiter. Resets per serverless instance.
// For production at scale, swap the store for Redis (Upstash free tier).
const store = new Map();

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * @param {object} req
 * @param {object} res
 * @param {object} opts  { windowMs, max, message }
 * @returns {boolean}  true if the request should be blocked
 */
function rateLimit(req, res, opts = {}) {
  const { windowMs = 60_000, max = 20, message = 'Too many requests. Please slow down.' } = opts;
  const key = `${req.url}:${getIp(req)}`;
  const now = Date.now();
  const entry = store.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  store.set(key, entry);

  res.setHeader('X-RateLimit-Limit', max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > max) {
    res.status(429).json({ message });
    return true;
  }
  return false;
}

module.exports = rateLimit;
