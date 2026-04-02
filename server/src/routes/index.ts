import { Hono } from 'hono';
import type { DbClient } from '@fd/db';
import type { Database as SqliteDatabase } from 'better-sqlite3';

import authRoutes from './auth.js';
import settingsRoutes from './settings.js';
import projectsRoutes from './projects.js';
import deploysRoutes from './deploys.js';
import systemRoutes from './system.js';
import backupsRoutes from './backups.js';

type Env = {
  Variables: {
    db: DbClient;
    sqlite: SqliteDatabase;
  };
};

const api = new Hono<Env>();

api.route('/auth', authRoutes);
api.route('/settings', settingsRoutes);
api.route('/projects', projectsRoutes);
api.route('/projects', deploysRoutes);
api.route('/system', systemRoutes);
api.route('/backups', backupsRoutes);

export default api;
