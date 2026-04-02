import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDb } from './client';

const DB_PATH = process.env.DATABASE_PATH || './data.db';

console.log(`Migrating database at: ${resolve(DB_PATH)}`);

const { db, sqlite } = createDb(DB_PATH);

migrate(db, { migrationsFolder: resolve(import.meta.dirname, 'migrations') });

console.log('Migration complete.');

sqlite.close();
