import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import { createDb, type DbClient } from '@fd/db';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { secureHeaders } from 'hono/secure-headers';
import { errorHandler } from './middleware/error-handler.js';
import { loggerMiddleware } from './middleware/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { createRateLimit } from './middleware/rate-limit.js';
import { csrfProtection } from './middleware/csrf.js';
import api from './routes/index.js';
import { startup as startupDeployQueue } from './queue/deploy-queue.js';
import { scheduleAutoBackup } from './services/backup-service.js';

type Env = {
  Variables: {
    db: DbClient;
    sqlite: SqliteDatabase;
  };
};

const app = new Hono<Env>();

// Database initialization
const dbPath = process.env.DATABASE_PATH || './data.db';
const { db, sqlite } = createDb(dbPath);

// Cleanup orphaned deploy locks on startup
startupDeployQueue(db);

// Schedule daily auto-backup
scheduleAutoBackup(sqlite);

// Global middleware
app.use('*', loggerMiddleware);

// Security headers
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
  }),
);

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
  c.set('sqlite', sqlite);
  await next();
});

// Rate limiting
app.use('/api/auth/*', createRateLimit(5, 60_000));
app.use('/api/*', createRateLimit(100, 60_000));

// CSRF protection (production only — skips in dev)
app.use('/api/*', csrfProtection);

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
  app.use('/*', serveStatic({ root: './ui/dist' }));
  app.get('*', serveStatic({ root: './ui/dist', path: 'index.html' }));
}

// Start server
const port = Number(process.env.PORT) || 9000;
console.log(`🚀 FrostDeploy server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });

export default app;
export type AppType = typeof app;
