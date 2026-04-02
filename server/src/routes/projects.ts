import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { DbClient } from '@fd/db';
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
    }),
  ),
  (c) => {
    const db = c.get('db');
    const { repo_url, branch } = c.req.valid('json');

    const pat = getGithubPat(db);

    const result = detectFramework(repo_url, branch, pat);
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

export default app;
