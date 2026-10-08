const buckets = new Map();

function getClientKey(req, keyBy = 'ip') {
  if (keyBy === 'user') return `user:${req.user?.id || req.ip || 'unknown'}`;
  return `ip:${req.ip || 'unknown'}`;
}

export function createRateLimiter({
  windowMs = 5 * 60 * 1000,
  max = 300,
  keyBy = 'ip',
  message = 'Too many requests. Please try again later.'
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = getClientKey(req, keyBy);
    const existing = buckets.get(key);

    if (!existing || existing.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > max) {
      const retryAfter = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message });
    }

    return next();
  };
}

export const globalRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 300,
  message: 'Too many requests from this client. Please slow down and try again later.'
});

export const loginRateLimiter = (() => {
  const windowMs = 15 * 60 * 1000;
  const max = 10;
  const message = 'Too many sign-in attempts. Please wait 15 minutes before trying again.';

  return (req, res, next) => {
    const now = Date.now();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const key = `login:${req.ip || 'unknown'}:${email || 'unknown'}`;
    const existing = buckets.get(key);

    if (!existing || existing.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
    } else {
      existing.count += 1;
      if (existing.count > max) {
        const retryAfter = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({ error: message });
      }
    }

    // A successful sign-in is not a failed attempt. Release its slot so a
    // normal logout/login cycle does not inherit a stale failed-attempt count.
    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const current = buckets.get(key);
        if (!current) return;
        current.count = Math.max(0, current.count - 1);
        if (current.count === 0) buckets.delete(key);
      }
    });

    return next();
  };
})();

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts. Please try again later.'
});

export const verificationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many verification requests. Please try again later.'
});

export const aiParseRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyBy: 'user',
  message: 'Too many resume parsing requests. Please try again later.'
});

export const aiScreenRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyBy: 'user',
  message: 'Too many screening requests. Please try again later.'
});

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.expiresAt <= now) buckets.delete(key);
  }
  if (buckets.size > 10000) buckets.clear();
}, 5 * 60 * 1000).unref();

export const resumeUploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyBy: 'user',
  message: 'Too many resume uploads. Please try again later.'
});

export const interviewEmailRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyBy: 'user',
  message: 'Too many interview emails have been sent. Please try again later.'
});
