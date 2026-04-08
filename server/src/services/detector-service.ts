import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { FRAMEWORKS } from '@fd/shared';
import type { Framework } from '@fd/shared';

interface DetectResult {
  framework: Framework;
  buildCmd: string;
  startCmd: string | null;
  outputDir: string;
}

export function detectFramework(
  repoUrl: string,
  branch?: string,
  pat?: string,
  rootDir?: string | null,
): DetectResult {
  const hex = randomBytes(4).toString('hex');
  const tmpDir = mkdtempSync(join(tmpdir(), `fd-detect-${hex}-`));

  try {
    const GITHUB_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/;
    if (!GITHUB_URL_RE.test(repoUrl)) {
      throw new Error('Invalid repository URL: only public GitHub HTTPS URLs are supported');
    }

    let cloneUrl = repoUrl;
    if (pat) {
      cloneUrl = repoUrl.replace('https://', `https://${pat}@`);
    }

    const args = ['clone', '--depth', '1'];
    if (branch) {
      args.push('--branch', branch);
    }
    args.push(cloneUrl, tmpDir);

    execFileSync('git', args, {
      timeout: 30_000,
      stdio: 'pipe',
    });

    // Effective directory: apply rootDir offset for monorepo support
    const effectiveDir = rootDir ? join(tmpDir, rootDir) : tmpDir;

    // Read package.json
    const pkgPath = join(effectiveDir, 'package.json');
    let deps: Record<string, string> = {};
    let devDeps: Record<string, string> = {};
    let scripts: Record<string, string> = {};

    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      deps = pkg.dependencies ?? {};
      devDeps = pkg.devDependencies ?? {};
      scripts = pkg.scripts ?? {};
    }

    const allDeps = { ...deps, ...devDeps };

    // Priority 1: Check dependencies for framework markers
    const frameworkOrder: Framework[] = [
      'nextjs',
      'nuxt',
      'sveltekit',
      'remix',
      'astro-ssr',
      'astro-static',
      'nestjs',
      'fastify',
      'koa',
      'express',
    ];

    for (const fw of frameworkOrder) {
      const config = FRAMEWORKS[fw];
      if (config.marker && allDeps[config.marker]) {
        // For Astro, distinguish SSR vs Static by checking config
        if (fw === 'astro-ssr' || fw === 'astro-static') {
          const resolved = resolveAstro(effectiveDir);
          return buildResult(resolved);
        }
        return buildResult(fw);
      }
    }

    // Priority 2: Check for config files
    for (const fw of frameworkOrder) {
      const config = FRAMEWORKS[fw];
      for (const cfgFile of config.configFiles) {
        if (existsSync(join(effectiveDir, cfgFile))) {
          if (fw === 'astro-ssr' || fw === 'astro-static') {
            const resolved = resolveAstro(effectiveDir);
            return buildResult(resolved);
          }
          return buildResult(fw);
        }
      }
    }

    // Priority 3: Check scripts.start for hints
    if (scripts.start) {
      for (const fw of frameworkOrder) {
        const config = FRAMEWORKS[fw];
        if (config.marker && scripts.start.includes(config.marker)) {
          return buildResult(fw);
        }
      }
    }

    // Fallback: static
    return buildResult('static');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function resolveAstro(dir: string): Framework {
  // Check if Astro config has output: 'server' or adapter configured
  for (const cfgFile of FRAMEWORKS['astro-ssr'].configFiles) {
    const cfgPath = join(dir, cfgFile);
    if (existsSync(cfgPath)) {
      const content = readFileSync(cfgPath, 'utf-8');
      if (
        content.includes("output: 'server'") ||
        content.includes('output: "server"') ||
        content.includes('adapter')
      ) {
        return 'astro-ssr';
      }
    }
  }
  return 'astro-static';
}

function buildResult(fw: Framework): DetectResult {
  const config = FRAMEWORKS[fw];
  return {
    framework: fw,
    buildCmd: config.buildCmd,
    startCmd: config.startCmd,
    outputDir: config.outputDir,
  };
}
