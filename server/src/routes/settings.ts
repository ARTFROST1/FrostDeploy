import { Hono } from 'hono';
import { z } from 'zod';
import { setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import type { DbClient } from '@fd/db';
import { setupSchema, changePasswordSchema, PORT_RANGE_START, PORT_RANGE_END } from '@fd/shared';
import { hashPassword, verifyPassword, signSession, generateSecret } from '../lib/crypto.js';
import {
  setSetting,
  setEncryptedSetting,
  getAllSettings,
  isSetupCompleted,
  getSetting,
} from '../services/settings-service.js';

type Env = {
  Variables: {
    db: DbClient;
  };
};

const SENSITIVE_KEYS = new Set(['github_pat', 'session_secret']);

const app = new Hono<Env>();

app.post('/setup', zValidator('json', setupSchema), async (c) => {
  const db = c.get('db');

  if (isSetupCompleted(db)) {
    return c.json(
      { success: false, error: { code: 'CONFLICT', message: 'Setup already completed' } },
      409,
    );
  }

  const { password, githubPat, platformDomain } = c.req.valid('json');

  // 1. Hash and store admin password
  const passwordHash = hashPassword(password);
  setSetting(db, 'admin_password_hash', passwordHash);

  // 2. Generate and store session secret (plain — auth middleware reads it raw)
  const sessionSecret = generateSecret();
  setSetting(db, 'session_secret', sessionSecret);

  // 3. Encrypt and store GitHub PAT
  setEncryptedSetting(db, 'github_pat', githubPat);

  // 4. Store platform domain
  setSetting(db, 'platform_domain', platformDomain);

  // 4.5 Store default port range
  setSetting(db, 'port_range_start', String(PORT_RANGE_START));
  setSetting(db, 'port_range_end', String(PORT_RANGE_END));

  // 5. Mark setup as completed
  setSetting(db, 'setup_completed', 'true');

  // 6. Auto-login
  const token = signSession({ role: 'admin' }, sessionSecret);
  const isProduction = process.env.NODE_ENV === 'production';

  setCookie(c, 'fd_session', token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isProduction,
    path: '/',
    maxAge: 86400,
  });

  return c.json({ success: true, data: { setup: true } });
});

app.get('/', (c) => {
  const db = c.get('db');
  const allSettings = getAllSettings(db);
  return c.json({ success: true, data: allSettings });
});

app.get('/setup-status', (c) => {
  const db = c.get('db');
  const completed = isSetupCompleted(db);
  return c.json({ success: true, data: { completed } });
});

const ALLOWED_SETTINGS_KEYS = [
  'platform_domain',
  'server_name',
  'github_pat',
  'port_range_start',
  'port_range_end',
] as const;

const updateSettingsSchema = z.object(
  Object.fromEntries(ALLOWED_SETTINGS_KEYS.map((key) => [key, z.string().optional()])) as Record<
    (typeof ALLOWED_SETTINGS_KEYS)[number],
    z.ZodOptional<z.ZodString>
  >,
);

app.put('/', zValidator('json', updateSettingsSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (SENSITIVE_KEYS.has(key)) {
      setEncryptedSetting(db, key, value);
    } else {
      setSetting(db, key, value);
    }
  }

  return c.json({ success: true, data: { updated: true } });
});

app.put('/password', zValidator('json', changePasswordSchema), async (c) => {
  const db = c.get('db');
  const { currentPassword, newPassword } = c.req.valid('json');

  const storedHash = getSetting(db, 'admin_password_hash');
  if (!storedHash || !verifyPassword(currentPassword, storedHash)) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Current password is incorrect' } },
      401,
    );
  }

  const newHash = hashPassword(newPassword);
  setSetting(db, 'admin_password_hash', newHash);

  return c.json({ success: true, data: { changed: true } });
});

export default app;
