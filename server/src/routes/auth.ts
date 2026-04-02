import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import type { DbClient } from '@fd/db';
import { loginSchema } from '@fd/shared';
import { verifyPassword, signSession } from '../lib/crypto.js';
import { getSetting, getDecryptedSetting } from '../services/settings-service.js';

type Env = {
  Variables: {
    db: DbClient;
  };
};

// Rate limiter: IP -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Clean up expired entries
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  entry.count++;
  if (entry.count > MAX_ATTEMPTS) return false;
  return true;
}

const app = new Hono<Env>();

app.post('/login', zValidator('json', loginSchema), async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

  if (!checkRateLimit(ip)) {
    return c.json(
      {
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again later.' },
      },
      429,
    );
  }

  const { password } = c.req.valid('json');
  const db = c.get('db');

  const passwordHash = getSetting(db, 'admin_password_hash');

  if (!passwordHash || !verifyPassword(password, passwordHash)) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid password' } },
      401,
    );
  }

  // Get session secret (stored unencrypted so auth middleware can read it directly)
  const sessionSecret = getDecryptedSetting(db, 'session_secret');
  if (!sessionSecret) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server configuration error' } },
      500,
    );
  }

  const token = signSession({ role: 'admin' }, sessionSecret);
  const isSecure = c.req.header('x-forwarded-proto') === 'https';

  setCookie(c, 'fd_session', token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isSecure,
    path: '/',
    maxAge: 86400,
  });

  return c.json({ success: true, data: { authenticated: true } });
});

app.post('/logout', (c) => {
  deleteCookie(c, 'fd_session', { path: '/' });
  return c.json({ success: true, data: { loggedOut: true } });
});

app.get('/check', (c) => {
  return c.json({ success: true, data: { authenticated: true } });
});

export default app;
