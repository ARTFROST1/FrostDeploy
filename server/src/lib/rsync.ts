import { execCommand } from './exec.js';

const SAFE_PATH_RE = /^[\w./\-]+$/;

function validatePath(path: string, label: string): void {
  if (!path || !SAFE_PATH_RE.test(path)) {
    throw new Error(`Invalid ${label}: "${path}" contains unsafe characters`);
  }
}

/**
 * Sync build artifacts to production runtime directory (two-directory model).
 *
 * 1. rsync build output → runtimeDir
 * 2. copy package.json / package-lock.json → runtimeDir
 * 3. npm ci --omit=dev in runtimeDir
 */
export async function syncFiles(
  srcDir: string,
  runtimeDir: string,
  outputDir: string,
  onLog?: (line: string) => void,
): Promise<void> {
  validatePath(srcDir, 'srcDir');
  validatePath(runtimeDir, 'runtimeDir');
  validatePath(outputDir, 'outputDir');

  // 1. rsync build artifacts to runtime dir
  await execCommand('rsync', ['-a', '--delete', `${srcDir}/${outputDir}/`, `${runtimeDir}/`], {
    onLog,
  });

  // 2. copy package.json and package-lock.json (if exist) to runtime dir
  await execCommand('cp', ['-f', `${srcDir}/package.json`, `${runtimeDir}/package.json`], {
    onLog,
  });

  // package-lock.json is optional — ignore errors if missing
  try {
    await execCommand(
      'cp',
      ['-f', `${srcDir}/package-lock.json`, `${runtimeDir}/package-lock.json`],
      { onLog },
    );
  } catch {
    // package-lock.json may not exist — that's fine
  }

  // 3. install production-only dependencies in runtime dir
  await execCommand('npm', ['ci', '--omit=dev'], {
    cwd: runtimeDir,
    onLog,
  });
}
