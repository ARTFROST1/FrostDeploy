import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index';

export function createDb(dbPath: string): {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: SqliteDatabase;
} {
  const sqlite = new Database(dbPath);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('cache_size = -20000');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('temp_store = MEMORY');
  sqlite.pragma('wal_autocheckpoint = 1000');

  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}

export type DbClient = ReturnType<typeof createDb>['db'];
