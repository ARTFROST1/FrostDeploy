import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import { createDb, type DbClient } from '@fd/db';
import { errorHandler } from './middleware/error-handler.js';
import { loggerMiddleware } from './middleware/logger.js';
import { authMiddleware } from './middleware/auth.js';
import api from './routes/index.js';
import { startup as startupDeployQueue } from './queue/deploy-queue.js';

type Env = {
  Variables: {
    db: DbClient;
  };
};

const app = new Hono<Env>();

// Database initialization
const dbPath = process.env.DATABASE_PATH || './data.db';
const { db } = createDb(dbPath);

// Cleanup orphaned deploy locks on startup
startupDeployQueue(db);

// Global middleware
app.use('*', loggerMiddleware);

// CORS (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use(
    '/api/*',
    cors({
      origin: 'http://localhost:5173',
      credentials: true,
    }),
  );
}

// Inject db into context
app.use('*', async (c, next) => {
  c.set('db', db);
  await next();
});

// Auth middleware for /api/* (except public paths)
app.use('/api/*', authMiddleware);

// Error handler
app.onError(errorHandler);

// Health check (no auth — useful for monitoring)
app.get('/health', (c) => c.json({ status: 'ok' }));

// API routes
app.route('/api', api);

// Static file serving (production only) — SPA fallback
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: '../ui/dist' }));
  app.get('*', serveStatic({ root: '../ui/dist', path: 'index.html' }));
}

// Start server
const port = Number(process.env.PORT) || 9000;
console.log(`🚀 FrostDeploy server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });

export default app;
export type AppType = typeof app;
