import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import ejs from 'ejs';

const IS_MAC = process.platform === 'darwin';
const SERVICE_PREFIX = 'frostdeploy-';
const UNIT_DIR = '/etc/systemd/system';
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export interface SystemdProject {
  name: string;
  runtimeDir: string;
  startCmd: string;
  port: number;
  envFilePath?: string;
  cpuQuota?: string;
  memoryMax?: string;
}

function serviceName(name: string): string {
  return `${SERVICE_PREFIX}${name}`;
}

function validateName(name: string): void {
  if (!NAME_RE.test(name)) {
    throw new Error(`Invalid service name: "${name}". Must match ${NAME_RE.toString()}`);
  }
}

function stub(operation: string): void {
  console.warn(`[systemd] STUB: ${operation} (macOS dev mode)`);
}

export async function createUnit(project: SystemdProject): Promise<void> {
  validateName(project.name);

  if (IS_MAC) {
    stub(`createUnit ${project.name}`);
    return;
  }

  const templatePath = join(import.meta.dirname, '..', 'templates', 'systemd.service.ejs');
  const template = readFileSync(templatePath, 'utf-8');
  const unit = ejs.render(template, project);

  const unitPath = join(UNIT_DIR, `${serviceName(project.name)}.service`);
  writeFileSync(unitPath, unit, 'utf-8');

  execFileSync('systemctl', ['daemon-reload']);
}

export async function deleteUnit(name: string): Promise<void> {
  validateName(name);

  if (IS_MAC) {
    stub(`deleteUnit ${name}`);
    return;
  }

  const unitPath = join(UNIT_DIR, `${serviceName(name)}.service`);
  if (existsSync(unitPath)) {
    unlinkSync(unitPath);
  }

  execFileSync('systemctl', ['daemon-reload']);
}

export async function startService(name: string): Promise<void> {
  validateName(name);

  if (IS_MAC) {
    stub(`startService ${name}`);
    return;
  }

  execFileSync('systemctl', ['start', serviceName(name)]);
}

export async function stopService(name: string): Promise<void> {
  validateName(name);

  if (IS_MAC) {
    stub(`stopService ${name}`);
    return;
  }

  execFileSync('systemctl', ['stop', serviceName(name)]);
}

export async function restartService(name: string): Promise<void> {
  validateName(name);

  if (IS_MAC) {
    stub(`restartService ${name}`);
    return;
  }

  execFileSync('systemctl', ['restart', serviceName(name)]);
}

export async function getStatus(name: string): Promise<string> {
  validateName(name);

  if (IS_MAC) {
    stub(`getStatus ${name}`);
    return 'inactive';
  }

  try {
    const output = execFileSync('systemctl', ['is-active', serviceName(name)], {
      encoding: 'utf-8',
    });
    return output.trim();
  } catch (err: unknown) {
    // systemctl is-active exits non-zero for inactive/failed services
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

export function readLogs(name: string, lines = 200): string[] {
  validateName(name);

  if (IS_MAC) {
    stub(`readLogs ${name}`);
    return [];
  }

  const output = execFileSync(
    'journalctl',
    ['-u', serviceName(name), '-n', String(lines), '--no-pager'],
    { encoding: 'utf-8' },
  );

  return output.split('\n').filter(Boolean);
}
