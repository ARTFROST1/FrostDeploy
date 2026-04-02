import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { domains } from '@fd/db';
import type { DbClient } from '@fd/db';
import type { SslStatus } from '@fd/shared';
import {
  generateRouteConfig,
  generateLogConfig,
  CADDY_ADMIN_URL,
  type CaddyRoute,
} from '../lib/caddy.js';

const IS_MAC = process.platform === 'darwin';

/** Wrapper around fetch that sets Origin header required by Caddy admin API. */
function caddyFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Origin: CADDY_ADMIN_URL,
    },
  });
}
const BACKUP_DIR = '/var/lib/frostdeploy/caddy-backup';

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function stub(operation: string): void {
  console.warn(`[proxy] STUB: ${operation} (macOS dev mode)`);
}

function validateDomain(domain: string): void {
  if (!DOMAIN_RE.test(domain)) {
    throw new Error(`Invalid domain: "${domain}"`);
  }
}

function isValidIpv4(ip: string): boolean {
  return IPV4_RE.test(ip);
}

// ---------------------------------------------------------------------------
// Part 1 — Add / Remove / List Routes (Task 3.2)
// ---------------------------------------------------------------------------

export async function addRoute(
  domain: string,
  port: number,
  isStatic: boolean,
  runtimeDir?: string,
  outputDir?: string,
): Promise<{ success: boolean; error?: string }> {
  validateDomain(domain);

  const route = await generateRouteConfig(domain, port, isStatic, runtimeDir, outputDir);

  if (IS_MAC) {
    stub(`addRoute ${domain} → port ${port}`);
    console.log('[proxy] Route config:', JSON.stringify(route, null, 2));
    const logConfig = await generateLogConfig(domain);
    console.log('[proxy] Log config:', JSON.stringify(logConfig, null, 2));
    return { success: true };
  }

  try {
    const res = await caddyFetch(`${CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `Caddy API ${res.status}: ${body}` };
    }

    // Apply access log config
    const logConfig = await generateLogConfig(domain);
    const sanitized = domain.replace(/\./g, '-');
    await caddyFetch(`${CADDY_ADMIN_URL}/config/logging/logs/access-${sanitized}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logConfig),
    });

    // Save backup
    mkdirSync(BACKUP_DIR, { recursive: true });
    writeFileSync(join(BACKUP_DIR, `${domain}.json`), JSON.stringify(route, null, 2), 'utf-8');

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function removeRoute(domain: string): Promise<{ success: boolean; error?: string }> {
  validateDomain(domain);

  if (IS_MAC) {
    stub(`removeRoute ${domain}`);
    return { success: true };
  }

  try {
    const res = await caddyFetch(`${CADDY_ADMIN_URL}/id/route-${domain}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `Caddy API ${res.status}: ${body}` };
    }

    // Remove backup file
    const backupPath = join(BACKUP_DIR, `${domain}.json`);
    if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function getRoutes(): Promise<CaddyRoute[]> {
  if (IS_MAC) {
    stub('getRoutes');
    return [];
  }

  try {
    const res = await caddyFetch(`${CADDY_ADMIN_URL}/config/apps/http/servers/srv0/routes`);
    if (!res.ok) return [];
    return (await res.json()) as CaddyRoute[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Part 2 — SSL Status Check (Task 3.3)
// ---------------------------------------------------------------------------

export async function checkSslStatus(
  db: DbClient,
  domain: string,
): Promise<{ sslStatus: SslStatus }> {
  validateDomain(domain);

  if (IS_MAC) {
    stub(`checkSslStatus ${domain}`);
    return { sslStatus: 'pending' };
  }

  let status: SslStatus = 'pending';

  try {
    const routes = await getRoutes();
    const hasRoute = routes.some((r) => r.match?.[0]?.host?.includes(domain));

    if (hasRoute) {
      const row = db
        .select({ verifiedAt: domains.verifiedAt })
        .from(domains)
        .where(eq(domains.domain, domain))
        .get();
      status = row?.verifiedAt ? 'active' : 'provisioning';
    }
    // else: no route in Caddy → stays 'pending'
  } catch {
    status = 'error';
  }

  db.update(domains)
    .set({ sslStatus: status, updatedAt: sql`(datetime('now'))` })
    .where(eq(domains.domain, domain))
    .run();

  return { sslStatus: status };
}

// ---------------------------------------------------------------------------
// Part 3 — DNS Verification (Task 3.4)
// ---------------------------------------------------------------------------

export async function verifyDns(
  domain: string,
  expectedIp: string,
): Promise<{ verified: boolean; actualIp?: string; instructions?: string }> {
  validateDomain(domain);

  if (IS_MAC) {
    stub(`verifyDns ${domain}`);
    return {
      verified: false,
      actualIp: '127.0.0.1',
      instructions: 'DNS verification not available on macOS',
    };
  }

  try {
    const output = execFileSync('dig', ['+short', 'A', domain], {
      encoding: 'utf-8',
      timeout: 10_000,
    });

    const lines = output.trim().split('\n');
    const actualIp = lines.find((line) => isValidIpv4(line.trim()))?.trim();

    if (!actualIp) {
      return {
        verified: false,
        instructions: `No A record found. Add an A record: ${domain} → ${expectedIp}`,
      };
    }

    if (actualIp === expectedIp) {
      return { verified: true, actualIp };
    }

    return {
      verified: false,
      actualIp,
      instructions: `Add an A record: ${domain} → ${expectedIp}`,
    };
  } catch {
    return {
      verified: false,
      instructions: `DNS lookup failed. Add an A record: ${domain} → ${expectedIp}`,
    };
  }
}

export async function verifyDnsWithRetry(
  db: DbClient,
  domain: string,
  expectedIp: string,
  maxAttempts: number = 20,
  intervalMs: number = 30_000,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await verifyDns(domain, expectedIp);

    if (result.verified) {
      db.update(domains)
        .set({
          verifiedAt: sql`(datetime('now'))`,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(domains.domain, domain))
        .run();
      return true;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return false;
}

export async function getServerIp(): Promise<string> {
  if (IS_MAC) {
    stub('getServerIp');
    return '127.0.0.1';
  }

  const output = execFileSync('curl', ['-s', '-4', 'https://ifconfig.me'], {
    encoding: 'utf-8',
    timeout: 10_000,
  }).trim();

  if (!isValidIpv4(output)) {
    throw new Error(`Unexpected response from ifconfig.me: "${output}"`);
  }

  return output;
}
