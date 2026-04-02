import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';
import { randomHex } from '../utils';

export const envVariables = sqliteTable(
  'env_variables',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomHex(8)),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    isSecret: integer('is_secret', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_env_variables_project').on(table.projectId),
    unique('idx_env_variables_project_key').on(table.projectId, table.key),
  ],
);
