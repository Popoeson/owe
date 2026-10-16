const crypto = require('crypto');

const MAX_FAILS = 10;
const WINDOW_MS = 10 * 60 * 1000;
const fails = new Map(); // ip -> { count, resetAt }

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

// Clean out expired entries now and then
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of fails) if (rec.resetAt <= now) fails.delete(ip);
}, WINDOW_MS).unref();

module.exports = function requireDoorCode(req, res, next) {
  const expected = process.env.DOOR_SCAN_CODE;
  if (!expected) {
    return res.status(503).json({ message: 'Door scanner is not configured.' });
  }

  const now = Date.now();
  const rec = fails.get(req.ip);
  if (rec && rec.resetAt > now && rec.count >= MAX_FAILS) {
    return res.status(429).json({ message: 'Too many attempts. Try again in a few minutes.' });
  }

  const supplied = req.body && req.body.doorCode;
  if (supplied && crypto.timingSafeEqual(digest(supplied), digest(expected))) {
    fails.delete(req.ip);
    return next();
  }

  const current = rec && rec.resetAt > now ? rec : { count: 0, resetAt: now + WINDOW_MS };
  current.count += 1;
  fails.set(req.ip, current);
  res.status(401).json({ message: 'Wrong door code.' });
};