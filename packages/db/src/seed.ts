import { resolve } from 'node:path';
import { createDb } from './client';
import { projects, deployments, envVariables } from './schema';
import { randomHex } from './utils';

const DB_PATH = process.env.DATABASE_PATH || './data.db';

console.log(`Seeding database at: ${resolve(DB_PATH)}`);

const { db, sqlite } = createDb(DB_PATH);

// Clear existing data
db.delete(envVariables).run();
db.delete(deployments).run();
db.delete(projects).run();

// Project 1: Astro SSR
const project1Id = randomHex(8);
db.insert(projects)
  .values({
    id: project1Id,
    name: 'my-astro-site',
    repoUrl: 'https://github.com/example/my-astro-site',
    branch: 'main',
    domain: 'astro.example.com',
    port: 4321,
    framework: 'astro-ssr',
    buildCmd: 'npm run build',
    startCmd: 'node dist/server/entry.mjs',
    outputDir: 'dist',
    srcDir: '/var/www/my-astro-site-src',
    runtimeDir: '/var/www/my-astro-site',
    serviceName: 'frostdeploy-my-astro-site',
    currentSha: 'abc1234567890abcdef1234567890abcdef123456',
    status: 'active',
  })
  .run();

// Project 2: Express API
const project2Id = randomHex(8);
db.insert(projects)
  .values({
    id: project2Id,
    name: 'express-api',
    repoUrl: 'https://github.com/example/express-api',
    branch: 'main',
    domain: 'api.example.com',
    port: 4322,
    framework: 'express',
    buildCmd: '',
    startCmd: 'npm start',
    outputDir: '',
    srcDir: '/var/www/express-api-src',
    runtimeDir: '/var/www/express-api',
    serviceName: 'frostdeploy-express-api',
    currentSha: 'def4567890abcdef1234567890abcdef12345678',
    status: 'active',
  })
  .run();

// Deployments for project 1
const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

db.insert(deployments)
  .values([
    {
      id: randomHex(8),
      projectId: project1Id,
      commitSha: 'abc1234567890abcdef1234567890abcdef123456',
      commitMsg: 'feat: add homepage',
      status: 'success',
      triggeredBy: 'manual',
      durationMs: 45000,
      startedAt: now,
      finishedAt: now,
    },
    {
      id: randomHex(8),
      projectId: project1Id,
      commitSha: 'bbb2234567890abcdef1234567890abcdef123456',
      commitMsg: 'fix: header alignment',
      status: 'success',
      triggeredBy: 'manual',
      durationMs: 38000,
      startedAt: now,
      finishedAt: now,
    },
    {
      id: randomHex(8),
      projectId: project1Id,
      commitSha: 'ccc3234567890abcdef1234567890abcdef123456',
      commitMsg: 'chore: update deps',
      status: 'failed',
      triggeredBy: 'manual',
      error: 'Build failed: Module not found',
      durationMs: 12000,
      startedAt: now,
      finishedAt: now,
    },
  ])
  .run();

// Deployments for project 2
db.insert(deployments)
  .values([
    {
      id: randomHex(8),
      projectId: project2Id,
      commitSha: 'def4567890abcdef1234567890abcdef12345678',
      commitMsg: 'feat: add /health endpoint',
      status: 'success',
      triggeredBy: 'webhook',
      durationMs: 22000,
      startedAt: now,
      finishedAt: now,
    },
    {
      id: randomHex(8),
      projectId: project2Id,
      commitSha: 'eee5567890abcdef1234567890abcdef12345678',
      commitMsg: 'feat: add rate limiting',
      status: 'building',
      triggeredBy: 'manual',
      startedAt: now,
    },
  ])
  .run();

// Env variables (values are fake encrypted placeholders)
db.insert(envVariables)
  .values([
    {
      id: randomHex(8),
      projectId: project1Id,
      key: 'DATABASE_URL',
      encryptedValue: 'enc:aes256gcm:fake-encrypted-value-1',
      isSecret: true,
    },
    {
      id: randomHex(8),
      projectId: project1Id,
      key: 'NODE_ENV',
      encryptedValue: 'enc:aes256gcm:production',
      isSecret: false,
    },
    {
      id: randomHex(8),
      projectId: project2Id,
      key: 'API_KEY',
      encryptedValue: 'enc:aes256gcm:fake-api-key-value',
      isSecret: true,
    },
  ])
  .run();

console.log('Seed complete:');
console.log('  - 2 projects');
console.log('  - 5 deployments (3 success, 1 failed, 1 building)');
console.log('  - 3 env variables');

sqlite.close();
