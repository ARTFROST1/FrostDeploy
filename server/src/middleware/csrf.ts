import type { MiddlewareHandler } from 'hono';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtection: MiddlewareHandler = async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    await next();
    return;
  }

  const origin = c.req.header('origin');
  const referer = c.req.header('referer');

  if (!origin && !referer) {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Missing Origin header' },
      },
      403,
    );
  }

  const host = c.req.header('host');

  let originMatch = false;
  let refererMatch = false;

  if (origin) {
    try {
      const url = new URL(origin);
      originMatch = url.host === host;
    } catch {
      // invalid origin URL
    }
  }

  if (referer) {
    try {
      const url = new URL(referer);
      refererMatch = url.host === host;
    } catch {
      // invalid referer URL
    }
  }

  if (!originMatch && !refererMatch) {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Origin mismatch' },
      },
      403,
    );
  }

  await next();
};
