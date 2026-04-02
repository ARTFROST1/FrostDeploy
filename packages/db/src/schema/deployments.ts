import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';
import { randomHex } from '../utils';

export const deployments = sqliteTable(
  'deployments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomHex(8)),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    commitSha: text('commit_sha').notNull(),
    commitMsg: text('commit_msg'),
    status: text('status', {
      enum: ['queued', 'building', 'deploying', 'success', 'failed', 'cancelled'],
    })
      .notNull()
      .default('queued'),
    logs: text('logs'),
    durationMs: integer('duration_ms'),
    error: text('error'),
    triggeredBy: text('triggered_by', {
      enum: ['manual', 'webhook', 'rollback', 'cli'],
    })
      .notNull()
      .default('manual'),
    startedAt: text('started_at'),
    finishedAt: text('finished_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_deployments_project_created').on(table.projectId, table.createdAt),
    index('idx_deployments_project_status').on(table.projectId, table.status),
    index('idx_deployments_status').on(table.status),
  ],
);
