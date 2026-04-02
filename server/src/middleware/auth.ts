import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { settings } from '@fd/db';
import type { DbClient } from '@fd/db';
import { verifySession } from '../lib/crypto.js';

const PUBLIC_PATHS = new Set([
  '/api/auth/login',
  '/api/settings/setup',
  '/api/settings/setup-status',
]);

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path);
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (isPublicPath(c.req.path)) {
    return next();
  }

  const db: DbClient = c.get('db');

  const row = await db.query.settings.findFirst({
    where: eq(settings.key, 'session_secret'),
  });

  if (!row) {
    // No session secret means setup hasn't run — block everything except /api/setup
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  const token = getCookie(c, 'fd_session');
  if (!token) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  const payload = verifySession(token, row.value);
  if (!payload) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      401,
    );
  }

  return next();
};
