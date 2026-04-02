import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { DbClient } from '@fd/db';
import { getSystemMetrics, getServiceLogs } from '../services/system-service.js';

type Env = { Variables: { db: DbClient } };

const app = new Hono<Env>();

// GET / — system metrics
app.get('/', async (c) => {
  const metrics = await getSystemMetrics();
  return c.json({ success: true, data: metrics });
});

const logsParamSchema = z.object({
  serviceName: z.string().regex(/^frostdeploy-[a-z0-9-]+$/),
});

const logsQuerySchema = z.object({
  lines: z.coerce.number().int().min(1).max(10000).default(200),
});

// GET /logs/:serviceName — service logs
app.get(
  '/logs/:serviceName',
  zValidator('param', logsParamSchema),
  zValidator('query', logsQuerySchema),
  (c) => {
    const { serviceName } = c.req.valid('param');
    const { lines } = c.req.valid('query');
    const logs = getServiceLogs(serviceName, lines);
    return c.json({ success: true, data: { logs } });
  },
);

export default app;
