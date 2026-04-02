import { Hono } from 'hono';
import type { DbClient } from '@fd/db';
import { getSystemMetrics, getServiceLogs } from '../services/system-service.js';

type Env = { Variables: { db: DbClient } };

const SERVICE_NAME_PATTERN = /^frostdeploy-[a-z0-9-]+$/;

const app = new Hono<Env>();

// GET / — system metrics
app.get('/', async (c) => {
  const metrics = await getSystemMetrics();
  return c.json({ success: true, data: metrics });
});

// GET /logs/:serviceName — service logs
app.get('/logs/:serviceName', (c) => {
  const serviceName = c.req.param('serviceName');

  if (!SERVICE_NAME_PATTERN.test(serviceName)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid service name format' } },
      400,
    );
  }

  const lines = Number(c.req.query('lines')) || 200;
  const logs = getServiceLogs(serviceName, lines);
  return c.json({ success: true, data: { logs } });
});

export default app;
