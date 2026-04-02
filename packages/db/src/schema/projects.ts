import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { randomHex } from '../utils';

export const projects = sqliteTable(
  'projects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomHex(8)),
    name: text('name').notNull(),
    repoUrl: text('repo_url').notNull(),
    branch: text('branch').notNull().default('main'),
    domain: text('domain'),
    port: integer('port').unique().notNull(),
    framework: text('framework'),
    buildCmd: text('build_cmd'),
    startCmd: text('start_cmd'),
    outputDir: text('output_dir').default('dist'),
    srcDir: text('src_dir').notNull(),
    runtimeDir: text('runtime_dir').notNull(),
    serviceName: text('service_name').notNull().unique(),
    currentSha: text('current_sha'),
    status: text('status', {
      enum: ['created', 'active', 'deploying', 'error', 'stopped'],
    })
      .notNull()
      .default('created'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_projects_status').on(table.status)],
);
