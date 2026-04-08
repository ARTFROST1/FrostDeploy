import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { projects, domains, type DbClient } from '@fd/db';
import { eq, sql } from 'drizzle-orm';
import { createProjectSchema, updateProjectSchema, updateEnvVarsSchema } from '@fd/shared';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectEnvVars,
  setProjectEnvVars,
} from '../services/project-service.js';
import { detectFramework } from '../services/detector-service.js';
import { getCommits } from '../services/git-service.js';
import { getDecryptedSetting } from '../services/settings-service.js';
import {
  addRoute,
  removeRoute,
  verifyDns,
  checkSslStatus,
  getServerIp,
} from '../services/proxy-service.js';

type Env = { Variables: { db: DbClient } };

function getGithubPat(db: DbClient): string | undefined {
  return getDecryptedSetting(db, 'github_pat') ?? undefined;
}

const app = new Hono<Env>();

// GET / — List all projects
app.get('/', (c) => {
  const db = c.get('db');
  const result = listProjects(db);
  return c.json({ success: true, data: result });
});

// POST / — Create project
app.post('/', zValidator('json', createProjectSchema), (c) => {
  const db = c.get('db');
  const data = c.req.valid('json');
  try {
    const created = createProject(db, data);
    return c.json({ success: true, data: created }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('No available ports')) {
      return c.json({ success: false, error: { code: 'CONFLICT', message: err.message } }, 409);
    }
    throw err;
  }
});

// POST /detect — Detect framework
app.post(
  '/detect',
  zValidator(
    'json',
    z.object({
      repo_url: z.string().url(),
      branch: z.string().optional(),
      root_dir: z.string().optional(),
    }),
  ),
  (c) => {
    const db = c.get('db');
    const { repo_url, branch, root_dir } = c.req.valid('json');

    const pat = getGithubPat(db);

    const result = detectFramework(repo_url, branch, pat, root_dir);
    return c.json({ success: true, data: result });
  },
);

// GET /:id — Get single project
app.get('/:id', (c) => {
  const db = c.get('db');
  const project = getProject(db, c.req.param('id'));
  if (!project)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  return c.json({ success: true, data: project });
});

// PUT /:id — Update project
app.put('/:id', zValidator('json', updateProjectSchema), (c) => {
  const db = c.get('db');
  const data = c.req.valid('json');
  const updated = updateProject(db, c.req.param('id'), data);
  if (!updated)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  return c.json({ success: true, data: updated });
});

// DELETE /:id — Delete project
app.delete('/:id', async (c) => {
  const db = c.get('db');
  const deleted = await deleteProject(db, c.req.param('id'));
  if (!deleted)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  return c.json({ success: true, data: { deleted: true } });
});

// GET /:id/env — Get env variables
app.get('/:id/env', (c) => {
  const db = c.get('db');
  const vars = getProjectEnvVars(db, c.req.param('id'));
  return c.json({ success: true, data: vars });
});

// PUT /:id/env — Update env variables
app.put('/:id/env', zValidator('json', updateEnvVarsSchema), (c) => {
  const db = c.get('db');
  const vars = c.req.valid('json');
  setProjectEnvVars(db, c.req.param('id'), vars);
  return c.json({ success: true, data: { updated: true } });
});

// GET /:id/commits — Get commits from GitHub
app.get('/:id/commits', async (c) => {
  const db = c.get('db');
  const project = getProject(db, c.req.param('id'));
  if (!project)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );

  const pat = getGithubPat(db);

  const commits = await getCommits(project.repoUrl, project.branch, pat);
  const result = commits.map((commit) => ({
    ...commit,
    isCurrent: commit.sha === project.currentSha,
  }));

  return c.json({ success: true, data: result });
});

// --- Domain management endpoints ---

const setDomainSchema = z.object({
  domain: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i,
      'Invalid domain format',
    ),
});

// PUT /:id/domain — Set domain for a project
app.put('/:id/domain', zValidator('json', setDomainSchema), async (c) => {
  const db = c.get('db');
  const { domain } = c.req.valid('json');
  const projectId = c.req.param('id');

  const project = getProject(db, projectId);
  if (!project)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );

  // Remove old domain if exists
  if (project.domain) {
    await removeRoute(project.domain).catch(() => {});
    db.delete(domains).where(eq(domains.projectId, projectId)).run();
  }

  // Update project domain
  db.update(projects)
    .set({ domain, updatedAt: sql`(datetime('now'))` })
    .where(eq(projects.id, projectId))
    .run();

  // Insert new domain record
  db.insert(domains).values({ projectId, domain, isPrimary: true, sslStatus: 'pending' }).run();

  const serverIp = await getServerIp();
  const updated = getProject(db, projectId);

  return c.json({
    success: true,
    data: {
      project: updated,
      dnsRecords: {
        domain,
        serverIp,
        records: [
          { type: 'A', name: '@', value: serverIp, description: 'Основная A-запись' },
          { type: 'A', name: 'www', value: serverIp, description: 'Запись для www субдомена' },
        ],
      },
    },
  });
});

// DELETE /:id/domain — Remove domain from project
app.delete('/:id/domain', async (c) => {
  const db = c.get('db');
  const projectId = c.req.param('id');

  const project = getProject(db, projectId);
  if (!project)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  if (!project.domain)
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Project has no domain' } },
      400,
    );

  await removeRoute(project.domain).catch(() => {});
  db.delete(domains).where(eq(domains.projectId, projectId)).run();
  db.update(projects)
    .set({ domain: null, updatedAt: sql`(datetime('now'))` })
    .where(eq(projects.id, projectId))
    .run();

  return c.json({ success: true, data: { removed: true } });
});

// GET /:id/dns-records — Get DNS records for project's domain
app.get('/:id/dns-records', async (c) => {
  const db = c.get('db');
  const project = getProject(db, c.req.param('id'));
  if (!project)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  if (!project.domain)
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Project has no domain' } },
      400,
    );

  const serverIp = await getServerIp();
  return c.json({
    success: true,
    data: {
      domain: project.domain,
      serverIp,
      records: [
        { type: 'A', name: '@', value: serverIp, description: 'Основная A-запись' },
        { type: 'A', name: 'www', value: serverIp, description: 'Запись для www субдомена' },
      ],
    },
  });
});

// POST /:id/dns-verify — Verify DNS for project's domain
app.post('/:id/dns-verify', async (c) => {
  const db = c.get('db');
  const projectId = c.req.param('id');

  const project = getProject(db, projectId);
  if (!project)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  if (!project.domain)
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Project has no domain' } },
      400,
    );

  const serverIp = await getServerIp();
  const result = await verifyDns(project.domain, serverIp);

  if (result.verified) {
    db.update(domains)
      .set({ verifiedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
      .where(eq(domains.domain, project.domain))
      .run();

    await addRoute(project.domain, project.port, false);

    return c.json({
      success: true,
      data: { verified: true, sslStatus: 'provisioning' },
    });
  }

  return c.json({
    success: true,
    data: { verified: false, actualIp: result.actualIp, expectedIp: serverIp },
  });
});

// GET /:id/ssl-status — Check SSL status
app.get('/:id/ssl-status', async (c) => {
  const db = c.get('db');
  const project = getProject(db, c.req.param('id'));
  if (!project)
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      404,
    );
  if (!project.domain)
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Project has no domain' } },
      400,
    );

  const domainRecord = db.select().from(domains).where(eq(domains.domain, project.domain)).get();

  if (!domainRecord?.verifiedAt) {
    return c.json({ success: true, data: { sslStatus: 'pending', domain: project.domain } });
  }

  const { sslStatus } = await checkSslStatus(db, project.domain);
  return c.json({ success: true, data: { sslStatus, domain: project.domain } });
});

export default app;
