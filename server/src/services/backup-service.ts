import { mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Database as SqliteDatabase } from 'better-sqlite3';

const BACKUP_DIR = process.env.BACKUP_DIR || '/var/lib/frostdeploy/backups';
const MAX_BACKUPS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const BACKUP_ID_RE = /^data-\d{8}-\d{6}$/;

export interface BackupInfo {
  id: string;
  filename: string;
  date: string;
  size: number;
}

function ensureBackupDir(): void {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

function formatTimestamp(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}-${h}${mi}${s}`;
}

export function listBackups(): BackupInfo[] {
  ensureBackupDir();

  return readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('data-') && f.endsWith('.db'))
    .map((filename) => {
      const filePath = join(BACKUP_DIR, filename);
      const stat = statSync(filePath);
      const id = filename.replace(/\.db$/, '');
      const match = filename.match(/^data-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.db$/);
      const date = match
        ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`
        : stat.mtime.toISOString();
      return { id, filename, date, size: stat.size };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function createBackup(sqlite: SqliteDatabase): Promise<BackupInfo> {
  ensureBackupDir();

  const now = new Date();
  const ts = formatTimestamp(now);
  const filename = `data-${ts}.db`;
  const targetPath = join(BACKUP_DIR, filename);

  // Checkpoint WAL for minimal backup size
  sqlite.pragma('wal_checkpoint(TRUNCATE)');

  // Online Backup API — consistent snapshot even during active writes
  await sqlite.backup(targetPath);

  rotateBackups();

  const stat = statSync(targetPath);
  return {
    id: filename.replace(/\.db$/, ''),
    filename,
    date: now.toISOString(),
    size: stat.size,
  };
}

export function rotateBackups(maxKeep: number = MAX_BACKUPS): void {
  const backups = listBackups();
  if (backups.length <= maxKeep) return;

  for (const backup of backups.slice(maxKeep)) {
    unlinkSync(join(BACKUP_DIR, backup.filename));
  }
}

export function restoreBackup(id: string, sqlite: SqliteDatabase, dbPath: string): void {
  if (!BACKUP_ID_RE.test(id)) {
    throw new Error('Invalid backup id');
  }

  const backupFile = join(BACKUP_DIR, `${id}.db`);
  if (!existsSync(backupFile)) {
    throw new Error('Backup not found');
  }

  // Close current connection before overwriting
  sqlite.close();

  copyFileSync(backupFile, dbPath);

  // Remove WAL/SHM leftovers from old DB
  for (const ext of ['-wal', '-shm']) {
    const p = `${dbPath}${ext}`;
    if (existsSync(p)) unlinkSync(p);
  }
}

let autoBackupTimer: ReturnType<typeof setInterval> | null = null;

export function scheduleAutoBackup(sqlite: SqliteDatabase): void {
  if (autoBackupTimer) return;

  autoBackupTimer = setInterval(async () => {
    try {
      const info = await createBackup(sqlite);
      console.log(`[backup] Auto-backup created: ${info.filename}`);
    } catch (err) {
      console.error('[backup] Auto-backup failed:', err);
    }
  }, DAY_MS);

  // Don't prevent process exit
  autoBackupTimer.unref();
}
