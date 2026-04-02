import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import * as schema from '@fd/db';
import {
  addRoute,
  removeRoute,
  getRoutes,
  verifyDns,
  verifyDnsWithRetry,
  getServerIp,
  checkSslStatus,
} from '../proxy-service';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
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

describe('addRoute (macOS stub)', () => {
  it('returns success on macOS', async () => {
    const result = await addRoute('example.com', 4321, false);
    expect(result).toEqual({ success: true });
  });

  it('validates domain — rejects invalid', async () => {
    await expect(addRoute('not a domain!', 4321, false)).rejects.toThrow('Invalid domain');
  });

  it('validates domain — rejects empty', async () => {
    await expect(addRoute('', 4321, false)).rejects.toThrow('Invalid domain');
  });
});

describe('removeRoute (macOS stub)', () => {
  it('returns success on macOS', async () => {
    const result = await removeRoute('example.com');
    expect(result).toEqual({ success: true });
  });

  it('validates domain input', async () => {
    await expect(removeRoute('bad domain!')).rejects.toThrow('Invalid domain');
  });
});

describe('getRoutes (macOS stub)', () => {
  it('returns empty array on macOS', async () => {
    const routes = await getRoutes();
    expect(routes).toEqual([]);
  });
});

describe('verifyDns (macOS stub)', () => {
  it('returns mock result on macOS', async () => {
    const result = await verifyDns('example.com', '1.2.3.4');
    expect(result.verified).toBe(false);
    expect(result.actualIp).toBe('127.0.0.1');
    expect(result.instructions).toContain('macOS');
  });

  it('validates domain input', async () => {
    await expect(verifyDns('not valid!', '1.2.3.4')).rejects.toThrow('Invalid domain');
  });
});

describe('getServerIp (macOS stub)', () => {
  it('returns 127.0.0.1 on macOS', async () => {
    const ip = await getServerIp();
    expect(ip).toBe('127.0.0.1');
  });
});

describe('checkSslStatus (macOS stub)', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    const ctx = createTestDb();
    db = ctx.db;
  });

  it('returns pending on macOS', async () => {
    const result = await checkSslStatus(db, 'example.com');
    expect(result.sslStatus).toBe('pending');
  });
});

describe('verifyDnsWithRetry (macOS stub)', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    const ctx = createTestDb();
    db = ctx.db;
  });

  it('returns false on macOS with maxAttempts=1', async () => {
    const result = await verifyDnsWithRetry(db, 'example.com', '1.2.3.4', 1, 0);
    expect(result).toBe(false);
  });
});
