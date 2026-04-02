export type ProjectStatus = 'created' | 'active' | 'deploying' | 'error' | 'stopped';

export type Framework =
  | 'astro-ssr'
  | 'astro-static'
  | 'nextjs'
  | 'nuxt'
  | 'sveltekit'
  | 'remix'
  | 'express'
  | 'fastify'
  | 'koa'
  | 'nestjs'
  | 'static';

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  domain: string | null;
  port: number;
  framework: Framework | null;
  buildCmd: string | null;
  startCmd: string | null;
  outputDir: string | null;
  srcDir: string;
  runtimeDir: string;
  serviceName: string;
  currentSha: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}
