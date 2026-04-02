import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';
import { randomHex } from '../utils';

export const domains = sqliteTable(
  'domains',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomHex(8)),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull().unique(),
    isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    sslStatus: text('ssl_status', {
      enum: ['pending', 'provisioning', 'active', 'error'],
    })
      .notNull()
      .default('pending'),
    verifiedAt: text('verified_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_domains_project').on(table.projectId)],
);
