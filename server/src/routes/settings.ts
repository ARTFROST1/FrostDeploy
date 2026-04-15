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
import { verifyDns, getServerIp } from '../services/proxy-service.js';
import { generateBaseCaddyfile, writeCaddyfile, reloadCaddy } from '../lib/caddy.js';

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
  const isSecure = c.req.header('x-forwarded-proto') === 'https';

  setCookie(c, 'fd_session', token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isSecure,
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
  'admin_domain',
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

  // When admin_domain changes, regenerate and reload Caddyfile
  if (body.admin_domain !== undefined) {
    const platformDomain = getSetting(db, 'platform_domain') ?? '';
    const serverPort = Number(process.env.PORT) || 9000;
    const adminDomain = body.admin_domain || undefined;
    const caddyfileContent = await generateBaseCaddyfile(platformDomain, serverPort, adminDomain);
    writeCaddyfile(caddyfileContent);
    await reloadCaddy();
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

// --- DNS Records & Verification ---

const IP_REGEX = /^\d{1,3}(\.\d{1,3}){3}$/;

app.get('/dns-records', async (c) => {
  const db = c.get('db');
  const domain = getSetting(db, 'platform_domain');

  if (!domain) {
    return c.json(
      { success: false, error: { code: 'NOT_CONFIGURED', message: 'Platform domain is not set' } },
      400,
    );
  }

  const serverIp = await getServerIp();

  if (IP_REGEX.test(domain)) {
    return c.json({
      success: true,
      data: { domain, serverIp, isDirect: true, records: [] },
    });
  }

  const records: { type: string; name: string; value: string; description: string }[] = [
    { type: 'A', name: '@', value: serverIp, description: 'Основная A-запись' },
  ];

  if (!domain.startsWith('*')) {
    records.push({
      type: 'A',
      name: '*',
      value: serverIp,
      description: 'Wildcard для субдоменов проектов',
    });
  }

  return c.json({
    success: true,
    data: { domain, serverIp, isDirect: false, records },
  });
});

const dnsVerifySchema = z.object({
  domain: z.string().optional(),
});

app.post('/dns-verify', zValidator('json', dnsVerifySchema), async (c) => {
  const db = c.get('db');
  const { domain: bodyDomain } = c.req.valid('json');
  const domain = bodyDomain || getSetting(db, 'platform_domain');

  if (!domain) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'No domain provided and platform domain is not set',
        },
      },
      400,
    );
  }

  if (IP_REGEX.test(domain)) {
    return c.json(
      {
        success: false,
        error: { code: 'INVALID_DOMAIN', message: 'Cannot verify DNS for an IP address' },
      },
      400,
    );
  }

  const serverIp = await getServerIp();
  const result = await verifyDns(domain, serverIp);

  return c.json({
    success: true,
    data: { domain, verified: result.verified, actualIp: result.actualIp, serverIp },
  });
});

app.get('/admin-domain-suggestion', (c) => {
  const db = c.get('db');
  const platformDomain = getSetting(db, 'platform_domain');

  if (!platformDomain || /^\d{1,3}(\.\d{1,3}){3}$/.test(platformDomain)) {
    return c.json({ success: true, data: { suggestion: null } });
  }

  return c.json({ success: true, data: { suggestion: `frostdeploy.${platformDomain}` } });
});

export default app;
