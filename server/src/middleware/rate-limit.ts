import type { MiddlewareHandler } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createRateLimit(maxRequests: number, windowMs: number): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();

  return async (c, next) => {
    const now = Date.now();

    // Clean expired entries
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }

    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown';

    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (entry.count < maxRequests) {
      entry.count++;
      await next();
      return;
    }

    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    c.header('Retry-After', String(retryAfter));
    return c.json(
      {
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Try again later.',
        },
      },
      429,
    );
  };
}
