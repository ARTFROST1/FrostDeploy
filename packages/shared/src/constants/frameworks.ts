import type { Framework } from '../types/project.js';

export interface FrameworkConfig {
  name: string;
  marker: string;
  configFiles: string[];
  buildCmd: string;
  startCmd: string | null;
  outputDir: string;
}

export const FRAMEWORKS: Record<Framework, FrameworkConfig> = {
  'astro-ssr': {
    name: 'Astro (SSR)',
    marker: 'astro',
    configFiles: ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'],
    buildCmd: 'npm run build',
    startCmd: 'node dist/server/entry.mjs',
    outputDir: 'dist',
  },
  'astro-static': {
    name: 'Astro (Static)',
    marker: 'astro',
    configFiles: ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'],
    buildCmd: 'npm run build',
    startCmd: null,
    outputDir: 'dist',
  },
  nextjs: {
    name: 'Next.js',
    marker: 'next',
    configFiles: ['next.config.mjs', 'next.config.ts', 'next.config.js'],
    buildCmd: 'npm run build',
    startCmd: 'npm start',
    outputDir: '.next',
  },
  nuxt: {
    name: 'Nuxt',
    marker: 'nuxt',
    configFiles: ['nuxt.config.ts', 'nuxt.config.js'],
    buildCmd: 'npm run build',
    startCmd: 'node .output/server/index.mjs',
    outputDir: '.output',
  },
  sveltekit: {
    name: 'SvelteKit',
    marker: '@sveltejs/kit',
    configFiles: ['svelte.config.js', 'svelte.config.ts'],
    buildCmd: 'npm run build',
    startCmd: 'node build',
    outputDir: 'build',
  },
  remix: {
    name: 'Remix',
    marker: '@remix-run/node',
    configFiles: ['remix.config.js', 'remix.config.ts'],
    buildCmd: 'npm run build',
    startCmd: 'npm start',
    outputDir: 'build',
  },
  express: {
    name: 'Express',
    marker: 'express',
    configFiles: [],
    buildCmd: '',
    startCmd: 'npm start',
    outputDir: '',
  },
  fastify: {
    name: 'Fastify',
    marker: 'fastify',
    configFiles: [],
    buildCmd: '',
    startCmd: 'npm start',
    outputDir: '',
  },
  koa: {
    name: 'Koa',
    marker: 'koa',
    configFiles: [],
    buildCmd: '',
    startCmd: 'npm start',
    outputDir: '',
  },
  nestjs: {
    name: 'NestJS',
    marker: '@nestjs/core',
    configFiles: [],
    buildCmd: 'npm run build',
    startCmd: 'npm start',
    outputDir: 'dist',
  },
  static: {
    name: 'Static Site',
    marker: '',
    configFiles: [],
    buildCmd: 'npm run build',
    startCmd: null,
    outputDir: 'dist',
  },
};
