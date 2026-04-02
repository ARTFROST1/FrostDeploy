import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ejs from 'ejs';

const IS_MAC = process.platform === 'darwin';

export const CADDY_ADMIN_URL = 'http://localhost:2019';

export interface CaddyRoute {
  '@id': string;
  match: Array<{ host: string[] }>;
  handle: Array<Record<string, unknown>>;
  terminal: boolean;
}

export interface CaddyLogConfig {
  writer: { output: string; filename: string; roll_size_mb: number; roll_keep: number };
  encoder: { format: string };
  include: string[];
}

export interface ReloadResult {
  success: boolean;
  error?: string;
}

function stub(operation: string): void {
  console.warn(`[caddy] STUB: ${operation} (macOS dev mode)`);
}

function sanitizeDomain(domain: string): string {
  return domain.replace(/\./g, '-');
}

export async function generateRouteConfig(
  domain: string,
  port: number,
  isStatic: boolean,
  runtimeDir?: string,
  outputDir?: string,
): Promise<CaddyRoute> {
  const handlers: Array<Record<string, unknown>> = [
    { handler: 'encode', encodings: { gzip: {}, zstd: {} } },
  ];

  if (isStatic) {
    if (!runtimeDir) {
      throw new Error('runtimeDir is required for static projects');
    }
    const resolvedOutput = outputDir ?? 'dist';
    handlers.push({
      handler: 'file_server',
      root: `${runtimeDir}/${resolvedOutput}`,
    });
  } else {
    handlers.push({
      handler: 'reverse_proxy',
      upstreams: [{ dial: `127.0.0.1:${port}` }],
    });
  }

  return {
    '@id': `route-${domain}`,
    match: [{ host: [domain] }],
    handle: handlers,
    terminal: true,
  };
}

export async function generateLogConfig(domain: string): Promise<CaddyLogConfig> {
  const sanitized = sanitizeDomain(domain);

  return {
    writer: {
      output: 'file',
      filename: `/var/log/caddy/${sanitized}-access.log`,
      roll_size_mb: 50,
      roll_keep: 5,
    },
    encoder: { format: 'json' },
    include: [`http.log.access.access-${sanitized}`],
  };
}

export async function validateConfig(): Promise<boolean> {
  if (IS_MAC) {
    stub('validateConfig');
    return true;
  }

  try {
    const res = await fetch(`${CADDY_ADMIN_URL}/config/`);
    return res.status === 200;
  } catch {
    return false;
  }
}

export async function reloadCaddy(): Promise<ReloadResult> {
  if (IS_MAC) {
    stub('reloadCaddy');
    return { success: true };
  }

  try {
    execFileSync('caddy', ['reload', '--config', '/etc/caddy/Caddyfile']);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function getCaddyStatus(): Promise<string> {
  if (IS_MAC) {
    stub('getCaddyStatus');
    return 'inactive';
  }

  try {
    const output = execFileSync('systemctl', ['is-active', 'caddy'], {
      encoding: 'utf-8',
    });
    return output.trim();
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'stdout' in err &&
      typeof (err as { stdout: unknown }).stdout === 'string'
    ) {
      return (err as { stdout: string }).stdout.trim() || 'unknown';
    }
    return 'unknown';
  }
}

export async function generateBaseCaddyfile(
  platformDomain: string,
  serverPort: number,
): Promise<string> {
  const templatePath = join(import.meta.dirname, '..', 'templates', 'caddyfile.ejs');
  const template = readFileSync(templatePath, 'utf-8');
  return ejs.render(template, { platformDomain, serverPort });
}
