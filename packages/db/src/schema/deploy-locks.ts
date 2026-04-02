import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';
import { deployments } from './deployments';

export const deployLocks = sqliteTable('deploy_locks', {
  projectId: text('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),
  deploymentId: text('deployment_id').references(() => deployments.id, {
    onDelete: 'set null',
  }),
  lockedAt: text('locked_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});
