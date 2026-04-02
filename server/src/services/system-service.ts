import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import * as os from 'os';
import type { SystemMetrics } from '@fd/shared';

const isLinux = process.platform === 'linux';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- CPU ---

interface CpuTimes {
  idle: number;
  total: number;
}

function readCpuTimesLinux(): CpuTimes {
  const stat = readFileSync('/proc/stat', 'utf-8');
  const line = stat.split('\n')[0]!; // "cpu  user nice system idle ..."
  const parts = line.split(/\s+/).slice(1).map(Number);
  const idle = parts[3] ?? 0;
  const total = parts.reduce((a, b) => a + b, 0);
  return { idle, total };
}

function readCpuTimesMac(): CpuTimes {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
}

function readCpuTimes(): CpuTimes {
  return isLinux ? readCpuTimesLinux() : readCpuTimesMac();
}

async function getCpuUsage(): Promise<{ usage: number; cores: number }> {
  const t1 = readCpuTimes();
  await sleep(100);
  const t2 = readCpuTimes();

  const idleDelta = t2.idle - t1.idle;
  const totalDelta = t2.total - t1.total;
  const usage = totalDelta === 0 ? 0 : ((totalDelta - idleDelta) / totalDelta) * 100;

  return { usage: Math.round(usage * 100) / 100, cores: os.cpus().length };
}

// --- Memory ---

function getMemory(): { used: number; total: number; percentage: number } {
  let totalBytes: number;
  let availableBytes: number;

  if (isLinux && existsSync('/proc/meminfo')) {
    const meminfo = readFileSync('/proc/meminfo', 'utf-8');
    const parse = (key: string): number => {
      const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
      return match ? Number(match[1]) * 1024 : 0; // kB → bytes
    };
    totalBytes = parse('MemTotal');
    availableBytes = parse('MemAvailable');
  } else {
    totalBytes = os.totalmem();
    availableBytes = os.freemem();
  }

  const usedBytes = totalBytes - availableBytes;
  const totalMB = Math.round(totalBytes / (1024 * 1024));
  const usedMB = Math.round(usedBytes / (1024 * 1024));
  const percentage = totalMB === 0 ? 0 : Math.round((usedMB / totalMB) * 10000) / 100;

  return { used: usedMB, total: totalMB, percentage };
}

// --- Disk ---

function getDisk(): { used: number; total: number; percentage: number } {
  try {
    const output = execSync('df -k /', { encoding: 'utf-8', timeout: 5000 });
    const lines = output.trim().split('\n');
    // Second line contains the data; fields may vary but we need 1K-blocks, Used, Available
    const parts = lines[1]!.split(/\s+/);
    const totalKB = Number(parts[1]);
    const usedKB = Number(parts[2]);

    const totalGB = Math.round((totalKB / (1024 * 1024)) * 100) / 100;
    const usedGB = Math.round((usedKB / (1024 * 1024)) * 100) / 100;
    const percentage = totalGB === 0 ? 0 : Math.round((usedGB / totalGB) * 10000) / 100;

    return { used: usedGB, total: totalGB, percentage };
  } catch {
    return { used: 0, total: 0, percentage: 0 };
  }
}

// --- Public API ---

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const cpu = await getCpuUsage();
  const memory = getMemory();
  const disk = getDisk();

  return {
    cpu,
    memory,
    disk,
    uptime: os.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
  };
}

const SERVICE_NAME_PATTERN = /^frostdeploy-[a-z0-9-]+$/;

export function getServiceLogs(serviceName: string, lines = 200): string[] {
  if (!SERVICE_NAME_PATTERN.test(serviceName)) {
    throw new Error(`Invalid service name: ${serviceName}`);
  }

  if (!isLinux) {
    return ['Service logs not available on macOS (development mode)'];
  }

  try {
    const output = execSync(`journalctl -u ${serviceName} -n ${lines} --no-pager --output=short`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [`Failed to retrieve logs for ${serviceName}`];
  }
}
