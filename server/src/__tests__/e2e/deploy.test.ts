/**
 * E2E integration test — full deploy pipeline.
 *
 * Boots an in-memory SQLite DB, builds a real Hono app instance,
 * runs setup → create project → deploy → verify SSE stream → check final state.
 *
 * All external side-effects (git, build, rsync, systemd, caddy, fs mkdir) are mocked.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import * as schema from '@fd/db';
import type { DbClient } from '@fd/db';

// ── Mocks (must appear before any imports that pull in the mocked modules) ──

vi.mock('../../services/git-service.js', () => ({
  cloneRepo: vi.fn().mockResolvedValue(undefined),
  fetchOrigin: vi.fn().mockResolvedValue(undefined),
  checkoutSha: vi.fn().mockResolvedValue(undefined),
  getCommits: vi.fn().mockResolvedValue([
    {
      sha: '0123456789abcdef0123456789abcdef01234567',
      message: 'test commit',
      author: 'test',
      date: new Date().toISOString(),
    },
  ]),
  parseGitHubUrl: vi.fn().mockReturnValue({ owner: 'test', repo: 'test-app' }),
}));

vi.mock('../../services/build-service.js', () => ({
  installDeps: vi.fn().mockResolvedValue(undefined),
  runBuild: vi.fn().mockResolvedValue(undefined),
  buildProject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/rsync.js', () => ({
  syncFiles: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/systemd.js', () => ({
  createUnit: vi.fn().mockResolvedValue(undefined),
  startService: vi.fn().mockResolvedValue(undefined),
  stopService: vi.fn().mockResolvedValue(undefined),
  restartService: vi.fn().mockResolvedValue(undefined),
  deleteUnit: vi.fn().mockResolvedValue(undefined),
  getStatus: vi.fn().mockResolvedValue('active'),
  readLogs: vi.fn().mockReturnValue([]),
}));

vi.mock('../../services/proxy-service.js', () => ({
  addRoute: vi.fn().mockResolvedValue({ success: true }),
  removeRoute: vi.fn().mockResolvedValue({ success: true }),
  getRoutes: vi.fn().mockResolvedValue([]),
  verifyDns: vi.fn().mockResolvedValue({ verified: true }),
  verifyDnsWithRetry: vi.fn().mockResolvedValue(true),
  getServerIp: vi.fn().mockResolvedValue('1.2.3.4'),
  checkSslStatus: vi.fn().mockResolvedValue({ sslStatus: 'pending' }),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return { ...actual, mkdirSync: vi.fn(), existsSync: vi.fn().mockReturnValue(false) };
});

// Mock global fetch for health-check requests (http://127.0.0.1:PORT/)
const originalFetch = globalThis.fetch;
globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('http://127.0.0.1:')) {
    return new Response('OK', { status: 200 });
  }
  return originalFetch(input, init);
}) as typeof fetch;

// ── Imports that depend on mocked modules ──

import api from '../../routes/index.js';
import { errorHandler } from '../../middleware/error-handler.js';
import { authMiddleware } from '../../middleware/auth.js';
import { loggerMiddleware } from '../../middleware/logger.js';

// ── Helpers ──

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  // FK disabled: deploy-queue acquireLock passes '' as deploymentId before creating the deployment row
  sqlite.pragma('foreign_keys = OFF');
  const db = drizzle(sqlite, { schema });
  migrate(db, {
    migrationsFolder: resolve(
      import.meta.dirname,
      '..',
      '..',
      '..',
      '..',
      'packages',
      'db',
      'src',
      'migrations',
    ),
  });
  return { db, sqlite };
}

function createTestApp(db: DbClient) {
  type Env = { Variables: { db: DbClient } };
  const app = new Hono<Env>();
  app.use('*', loggerMiddleware);
  app.use('*', async (c, next) => {
    c.set('db', db);
    await next();
  });
  app.use('/api/*', authMiddleware);
  app.onError(errorHandler);
  app.route('/api', api);
  return app;
}

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/fd_session=([^;]+)/);
  if (!match) throw new Error(`No fd_session cookie in response: ${setCookie}`);
  return match[1]!;
}

interface SSEParsedEvent {
  event?: string;
  data: Record<string, unknown>;
}

function parseSSEBody(body: string): SSEParsedEvent[] {
  const results: SSEParsedEvent[] = [];
  for (const chunk of body.split('\n\n')) {
    if (!chunk.trim()) continue;
    const lines = chunk.split('\n');
    const eventLine = lines.find((l) => l.startsWith('event: '));
    const dataLine = lines.find((l) => l.startsWith('data: '));
    if (!dataLine) continue;
    results.push({
      event: eventLine ? eventLine.slice(7) : undefined,
      data: JSON.parse(dataLine.slice(6)) as Record<string, unknown>,
    });
  }
  return results;
}

// ── Test suite ──

describe('E2E: full deploy pipeline', () => {
  let app: ReturnType<typeof createTestApp>;
  let _sqlite: ReturnType<typeof Database>;
  let sessionToken: string;
  let projectId: string;

  const TEST_SHA = '0123456789abcdef0123456789abcdef01234567';

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing';
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
    globalThis.fetch = originalFetch;
  });

  it('setup → login → create project → deploy → verify', async () => {
    // ── 1. Boot in-memory DB + app ──
    const testDb = createTestDb();
    _sqlite = testDb.sqlite;
    app = createTestApp(testDb.db);

    // ── 2. Initial setup ──
    const setupRes = await app.request('/api/settings/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'test123456',
        githubPat: 'ghp_testtoken12345',
        platformDomain: 'test.example.com',
      }),
    });

    expect(setupRes.status).toBe(200);
    const setupJson = (await setupRes.json()) as { success: boolean; data: { setup: boolean } };
    expect(setupJson.success).toBe(true);
    expect(setupJson.data.setup).toBe(true);

    sessionToken = extractSessionCookie(setupRes);
    expect(sessionToken).toBeTruthy();

    // ── 3. Verify login works with returned session ──
    const meRes = await app.request('/api/settings/setup-status', {
      headers: { Cookie: `fd_session=${sessionToken}` },
    });
    expect(meRes.status).toBe(200);
    const meJson = (await meRes.json()) as { success: boolean; data: { completed: boolean } };
    expect(meJson.data.completed).toBe(true);

    // ── 4. Auth via login endpoint ──
    const loginRes = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test123456' }),
    });
    expect(loginRes.status).toBe(200);
    const loginJson = (await loginRes.json()) as { success: boolean };
    expect(loginJson.success).toBe(true);

    // Use the login session for subsequent requests
    sessionToken = extractSessionCookie(loginRes);

    // ── 5. Create project ──
    const createRes = await app.request('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `fd_session=${sessionToken}`,
      },
      body: JSON.stringify({
        name: 'test-app',
        repoUrl: 'https://github.com/test/test-app',
        branch: 'main',
      }),
    });

    expect(createRes.status).toBe(201);
    const createJson = (await createRes.json()) as {
      success: boolean;
      data: { id: string; name: string; status: string };
    };
    expect(createJson.success).toBe(true);
    expect(createJson.data.name).toBe('test-app');
    projectId = createJson.data.id;
    expect(projectId).toBeTruthy();

    // ── 6. Trigger deploy (returns SSE stream) ──
    const deployRes = await app.request(`/api/projects/${projectId}/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `fd_session=${sessionToken}`,
      },
      body: JSON.stringify({ sha: TEST_SHA }),
    });

    expect(deployRes.status).toBe(200);

    // Read SSE stream to completion
    const body = await deployRes.text();
    const events = parseSSEBody(body);

    // Verify we received expected event types
    const eventTypes = events.map((e) => e.event ?? e.data.type);
    expect(eventTypes).toContain('status');
    expect(eventTypes).toContain('step');
    expect(eventTypes).toContain('complete');
    // Should NOT contain error
    expect(eventTypes).not.toContain('error');

    // Verify pipeline steps
    const stepEvents = events.filter((e) => (e.event ?? e.data.type) === 'step');
    const completedSteps = stepEvents
      .filter((e) => e.data.status === 'success')
      .map((e) => e.data.step);
    expect(completedSteps).toContain('fetch');
    expect(completedSteps).toContain('checkout');
    expect(completedSteps).toContain('install');
    expect(completedSteps).toContain('build');
    expect(completedSteps).toContain('sync');
    expect(completedSteps).toContain('restart');
    expect(completedSteps).toContain('healthcheck');

    // Verify complete event message
    const completeEvent = events.find((e) => (e.event ?? e.data.type) === 'complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent!.data.message).toMatch(/Deploy successful/);

    // ── 7. Verify project state after deploy ──
    // Small delay to let async DB writes settle
    await new Promise((r) => setTimeout(r, 100));

    const projectRes = await app.request(`/api/projects/${projectId}`, {
      headers: { Cookie: `fd_session=${sessionToken}` },
    });
    expect(projectRes.status).toBe(200);
    const projectJson = (await projectRes.json()) as {
      success: boolean;
      data: { status: string; currentSha: string | null };
    };
    expect(projectJson.success).toBe(true);
    expect(projectJson.data.status).toBe('active');
    expect(projectJson.data.currentSha).toBe(TEST_SHA);

    // ── 8. Verify deployment record ──
    const deploymentsRes = await app.request(`/api/projects/${projectId}/deployments?page=1`, {
      headers: { Cookie: `fd_session=${sessionToken}` },
    });
    expect(deploymentsRes.status).toBe(200);
    const deploymentsJson = (await deploymentsRes.json()) as {
      success: boolean;
      data: {
        data: Array<{
          status: string;
          commitSha: string;
          durationMs: number | null;
          triggeredBy: string;
        }>;
        total: number;
      };
    };
    expect(deploymentsJson.success).toBe(true);
    expect(deploymentsJson.data.total).toBeGreaterThanOrEqual(1);

    const lastDeploy = deploymentsJson.data.data[0]!;
    expect(lastDeploy.status).toBe('success');
    expect(lastDeploy.commitSha).toBe(TEST_SHA);
    expect(lastDeploy.durationMs).toBeGreaterThan(0);
    expect(lastDeploy.triggeredBy).toBe('manual');
  }, 30_000);

  it('rejects unauthenticated requests', async () => {
    const testDb = createTestDb();
    const testApp = createTestApp(testDb.db);

    const res = await testApp.request('/api/projects', {
      headers: { 'Content-Type': 'application/json' },
    });

    // No setup done → SETUP_REQUIRED (403)
    expect(res.status).toBe(403);
    const json = (await res.json()) as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
  });

  it('rejects duplicate setup', async () => {
    const testDb = createTestDb();
    const testApp = createTestApp(testDb.db);

    // First setup
    await testApp.request('/api/settings/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'test123456',
        githubPat: 'ghp_testtoken12345',
        platformDomain: 'test.example.com',
      }),
    });

    // Second setup — should be rejected
    const res = await testApp.request('/api/settings/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'test123456',
        githubPat: 'ghp_testtoken12345',
        platformDomain: 'test.example.com',
      }),
    });

    expect(res.status).toBe(409);
    const json = (await res.json()) as { success: boolean; error: { code: string } };
    expect(json.error.code).toBe('CONFLICT');
  });

  it('rejects wrong password login', async () => {
    const testDb = createTestDb();
    const testApp = createTestApp(testDb.db);

    // Setup
    await testApp.request('/api/settings/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'correct-password',
        githubPat: 'ghp_testtoken12345',
        platformDomain: 'test.example.com',
      }),
    });

    // Wrong password
    const res = await testApp.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    });

    expect(res.status).toBe(401);
    const json = (await res.json()) as { success: boolean; error: { code: string } };
    expect(json.error.code).toBe('UNAUTHORIZED');
  });
});
