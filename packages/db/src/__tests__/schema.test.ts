import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import { projects, deployments } from '../schema';
import * as schema from '../schema';
import { randomHex } from '../utils';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve(import.meta.dirname, '..', 'migrations') });
  return { db, sqlite };
}

describe('Database Schema', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  let sqlite: ReturnType<typeof createTestDb>['sqlite'];

  beforeEach(() => {
    const ctx = createTestDb();
    db = ctx.db;
    sqlite = ctx.sqlite;
  });

  it('should create all 6 tables', () => {
    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'deploy_locks',
      'deployments',
      'domains',
      'env_variables',
      'projects',
      'settings',
    ]);
  });

  it('should insert and read a project', () => {
    const id = randomHex(8);
    db.insert(projects)
      .values({
        id,
        name: 'test-project',
        repoUrl: 'https://github.com/test/repo',
        port: 4321,
        srcDir: '/var/www/test-src',
        runtimeDir: '/var/www/test',
        serviceName: 'frostdeploy-test',
      })
      .run();

    const result = db.select().from(projects).all();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('test-project');
    expect(result[0]!.status).toBe('created');
    expect(result[0]!.branch).toBe('main');
  });

  it('should cascade delete deployments when project is deleted', () => {
    const projectId = randomHex(8);
    db.insert(projects)
      .values({
        id: projectId,
        name: 'cascade-test',
        repoUrl: 'https://github.com/test/cascade',
        port: 4322,
        srcDir: '/var/www/cascade-src',
        runtimeDir: '/var/www/cascade',
        serviceName: 'frostdeploy-cascade',
      })
      .run();

    db.insert(deployments)
      .values({
        id: randomHex(8),
        projectId,
        commitSha: 'a'.repeat(40),
        status: 'success',
        triggeredBy: 'manual',
      })
      .run();

    expect(db.select().from(deployments).all()).toHaveLength(1);

    db.delete(projects)
      .where(sql`${projects.id} = ${projectId}`)
      .run();

    expect(db.select().from(deployments).all()).toHaveLength(0);
  });
});
