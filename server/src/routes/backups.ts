import { Hono } from 'hono';
import type { DbClient } from '@fd/db';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { listBackups, createBackup, restoreBackup } from '../services/backup-service.js';

type Env = {
  Variables: {
    db: DbClient;
    sqlite: SqliteDatabase;
  };
};

const app = new Hono<Env>();

app.get('/', (c) => {
  const backups = listBackups();
  return c.json({ success: true, data: backups });
});

app.post('/', async (c) => {
  const sqlite = c.get('sqlite');
  try {
    const info = await createBackup(sqlite);
    return c.json({ success: true, data: info }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Backup failed';
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }
});

app.post('/:id/restore', async (c) => {
  const id = c.req.param('id');
  const sqlite = c.get('sqlite');
  const dbPath = process.env.DATABASE_PATH || './data.db';

  try {
    restoreBackup(id, sqlite, dbPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Restore failed';
    if (message === 'Invalid backup id') {
      return c.json({ success: false, error: { code: 'BAD_REQUEST', message } }, 400);
    }
    if (message === 'Backup not found') {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message } }, 404);
    }
    return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message } }, 500);
  }

  // Schedule process exit after response flushes — systemd will restart the server
  setTimeout(() => process.exit(0), 500);

  return c.json({
    success: true,
    data: { restored: true, message: 'Server will restart to apply restored database' },
  });
});

export default app;
