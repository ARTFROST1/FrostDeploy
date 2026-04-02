import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { deployments } from '@fd/db';
import type { DbClient } from '@fd/db';
import { triggerDeploySchema } from '@fd/shared';
import { getProject } from '../services/project-service.js';
import { getDeploymentsByProject, getDeploymentById } from '../services/deploy-service.js';
import { enqueue, DeployConflictError } from '../queue/deploy-queue.js';
import { createDeployStream, type SSEEvent } from '../lib/sse.js';
import { getCommits } from '../services/git-service.js';
import { getDecryptedSetting } from '../services/settings-service.js';

type Env = { Variables: { db: DbClient } };

// --- SSE Bridge: buffers deploy events and fans out to SSE subscribers ---

interface DeploySSEBridge {
  buffer: SSEEvent[];
  listeners: Set<(event: SSEEvent) => Promise<void>>;
}

const bridges = new Map<string, DeploySSEBridge>();

function createBridge(projectId: string): DeploySSEBridge {
  bridges.delete(projectId);
  const bridge: DeploySSEBridge = { buffer: [], listeners: new Set() };
  bridges.set(projectId, bridge);
  return bridge;
}

function bridgeOnEvent(projectId: string): (event: SSEEvent) => Promise<void> {
  return async (event) => {
    const bridge = bridges.get(projectId);
    if (!bridge) return;

    bridge.buffer.push(event);

    const promises: Promise<void>[] = [];
    for (const listener of bridge.listeners) {
      promises.push(
        listener(event).catch(() => {
          bridge.listeners.delete(listener);
        }),
      );
    }
    await Promise.all(promises);

    if (event.type === 'complete' || event.type === 'error') {
      setTimeout(() => bridges.delete(projectId), 30_000);
    }
  };
}

function subscribeToStream(
  bridge: DeploySSEBridge,
  send: (event: SSEEvent) => Promise<void>,
): Promise<void> {
  // Snapshot buffer before subscribing to avoid race conditions
  const buffered = [...bridge.buffer];

  return new Promise<void>((resolve) => {
    // If deploy already completed, just replay buffered events
    const last = buffered[buffered.length - 1];
    if (last && (last.type === 'complete' || last.type === 'error')) {
      void (async () => {
        for (const event of buffered) {
          try {
            await send(event);
          } catch {
            break;
          }
        }
        resolve();
      })();
      return;
    }

    // Subscribe for future events
    const listener = async (event: SSEEvent) => {
      try {
        await send(event);
      } catch {
        bridge.listeners.delete(listener);
        resolve();
        return;
      }
      if (event.type === 'complete' || event.type === 'error') {
        bridge.listeners.delete(listener);
        resolve();
      }
    };
    bridge.listeners.add(listener);

    // Replay buffered events after subscribing (no events missed)
    void (async () => {
      for (const event of buffered) {
        try {
          await send(event);
        } catch {
          break;
        }
      }
    })();
  });
}

// --- Routes ---

const app = new Hono<Env>();

// POST /:id/deploy — Trigger deploy, returns SSE stream
app.post('/:id/deploy', zValidator('json', triggerDeploySchema), async (c) => {
  const db = c.get('db');
  const { sha: inputSha, force } = c.req.valid('json');

  const project = getProject(db, c.req.param('id'));
  if (!project) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  }

  // Resolve SHA from latest commit if not provided
  let sha = inputSha;
  let commitMsg: string | null = null;
  if (!sha) {
    const pat = getDecryptedSetting(db, 'github_pat') ?? undefined;
    const commits = await getCommits(project.repoUrl, project.branch, pat);
    if (commits.length === 0) {
      return c.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'No commits found in repository' },
        },
        400,
      );
    }
    sha = commits[0]!.sha;
    commitMsg = commits[0]!.message;
  }

  const bridge = createBridge(project.id);
  const onEvent = bridgeOnEvent(project.id);

  try {
    enqueue(db, project, sha, commitMsg, 'manual', onEvent, force);
  } catch (err) {
    bridges.delete(project.id);
    if (err instanceof DeployConflictError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Deploy in progress',
            deployId: err.deployId,
            startedAt: err.startedAt.toISOString(),
          },
        },
        409,
      );
    }
    throw err;
  }

  return createDeployStream(c, (send) => subscribeToStream(bridge, send));
});

// GET /:id/deploy/stream — Reconnect to active deploy SSE stream
app.get('/:id/deploy/stream', (c) => {
  const db = c.get('db');
  const project = getProject(db, c.req.param('id'));
  if (!project) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  }

  const bridge = bridges.get(project.id);
  if (!bridge) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'No active deploy' } },
      404,
    );
  }

  return createDeployStream(c, (send) => subscribeToStream(bridge, send));
});

// GET /:id/deployments — Deploy history (paginated)
app.get('/:id/deployments', (c) => {
  const db = c.get('db');
  const projectId = c.req.param('id');
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(c.req.query('perPage')) || 20));

  const result = getDeploymentsByProject(db, projectId, page, perPage);
  return c.json({ success: true, data: result });
});

// GET /:id/deployments/:deployId — Single deployment details
app.get('/:id/deployments/:deployId', (c) => {
  const db = c.get('db');
  const deployment = getDeploymentById(db, c.req.param('id'), c.req.param('deployId'));
  if (!deployment) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Deployment not found' } },
      404,
    );
  }
  return c.json({ success: true, data: deployment });
});

// POST /:id/rollback/:sha — Rollback to specific SHA
app.post('/:id/rollback/:sha', (c) => {
  const db = c.get('db');
  const projectId = c.req.param('id');
  const sha = c.req.param('sha');

  const project = getProject(db, projectId);
  if (!project) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  }

  // Validate SHA exists in successful deployment history
  const successfulDeploy = db
    .select({ id: deployments.id })
    .from(deployments)
    .where(
      and(
        eq(deployments.projectId, projectId),
        eq(deployments.commitSha, sha),
        eq(deployments.status, 'success'),
      ),
    )
    .get();

  if (!successfulDeploy) {
    return c.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'SHA not found in successful deployments' },
      },
      400,
    );
  }

  createBridge(project.id);
  const onEvent = bridgeOnEvent(project.id);

  try {
    enqueue(db, project, sha, null, 'rollback', onEvent, true);
  } catch (err) {
    bridges.delete(project.id);
    if (err instanceof DeployConflictError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Deploy in progress',
            deployId: err.deployId,
            startedAt: err.startedAt.toISOString(),
          },
        },
        409,
      );
    }
    throw err;
  }

  return c.json({ success: true, data: { message: 'Rollback started' } });
});

export default app;
