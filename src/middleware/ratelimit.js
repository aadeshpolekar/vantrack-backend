// Simple in-memory rate limiter — no external package needed.
// Tracks request counts per IP address within a rolling time window.

const buckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets.entries()) {
    if (now - entry.windowStart > 60 * 60 * 1000) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 0 };
      buckets.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      return res.status(429).json({
        error: message || "Too many requests. Please try again later.",
      });
    }

    next();
  };
}

module.exports = rateLimit;