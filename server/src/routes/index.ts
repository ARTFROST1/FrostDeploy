import { Hono } from 'hono';
import type { DbClient } from '@fd/db';

import authRoutes from './auth.js';
import settingsRoutes from './settings.js';
import projectsRoutes from './projects.js';
import deploysRoutes from './deploys.js';
import systemRoutes from './system.js';

type Env = {
  Variables: {
    db: DbClient;
  };
};

const api = new Hono<Env>();

api.route('/auth', authRoutes);
api.route('/settings', settingsRoutes);
api.route('/projects', projectsRoutes);
api.route('/projects', deploysRoutes);
api.route('/system', systemRoutes);

export default api;
