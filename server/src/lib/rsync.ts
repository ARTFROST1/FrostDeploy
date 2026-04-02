import { execCommand } from './exec.js';

const SAFE_PATH_RE = /^[\w./\-]+$/;

function validatePath(path: string, label: string): void {
  if (!path || !SAFE_PATH_RE.test(path)) {
    throw new Error(`Invalid ${label}: "${path}" contains unsafe characters`);
  }
}

/**
 * Sync entire source to production runtime directory (two-directory model).
 *
 * 1. rsync srcDir → runtimeDir (excluding node_modules and .git)
 * 2. npm ci --omit=dev in runtimeDir
 *
 * This preserves the full project structure so any framework
 * (Next.js, Vite, static, etc.) finds its expected layout.
 */
export async function syncFiles(
  srcDir: string,
  runtimeDir: string,
  _outputDir: string,
  onLog?: (line: string) => void,
): Promise<void> {
  validatePath(srcDir, 'srcDir');
  validatePath(runtimeDir, 'runtimeDir');

  // 1. rsync entire source to runtime dir, excluding heavy/dev-only dirs
  await execCommand(
    'rsync',
    ['-a', '--delete', '--exclude=node_modules', '--exclude=.git', `${srcDir}/`, `${runtimeDir}/`],
    { onLog },
  );

  // 2. install production-only dependencies in runtime dir
  await execCommand('npm', ['ci', '--omit=dev'], {
    cwd: runtimeDir,
    onLog,
  });
}
