import { execCommand } from '../lib/exec.js';

const BUILD_TIMEOUT_MS = 600_000; // 10 minutes

/**
 * Install dependencies.
 * Note: lifecycle scripts are allowed because the build step already executes
 * arbitrary user code. Frameworks like Next.js need postinstall (e.g. @next/swc).
 */
export async function installDeps(srcDir: string, onLog?: (line: string) => void): Promise<void> {
  const logLines: string[] = [];

  const collectLog = (line: string) => {
    logLines.push(line);
    onLog?.(line);
  };

  try {
    await execCommand('npm', ['ci'], {
      cwd: srcDir,
      timeout: BUILD_TIMEOUT_MS,
      onLog: collectLog,
    });
  } catch (err) {
    const tail = logLines.slice(-50).join('\n');
    throw new Error(`Dependency installation failed in ${srcDir}:\n${tail}`, { cause: err });
  }
}

/**
 * Run build command (e.g. "npm run build")
 */
export async function runBuild(
  srcDir: string,
  buildCmd: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const logLines: string[] = [];

  const collectLog = (line: string) => {
    logLines.push(line);
    onLog?.(line);
  };

  const [cmd, ...args] = buildCmd.split(/\s+/);
  if (!cmd) {
    throw new Error('Build command is empty');
  }

  try {
    await execCommand(cmd, args, {
      cwd: srcDir,
      timeout: BUILD_TIMEOUT_MS,
      onLog: collectLog,
    });
  } catch (err) {
    const tail = logLines.slice(-50).join('\n');
    throw new Error(`Build command failed: ${buildCmd}\n${tail}`, { cause: err });
  }
}

/**
 * Convenience wrapper: install deps then build.
 */
export async function buildProject(
  srcDir: string,
  buildCmd: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await installDeps(srcDir, onLog);
  await runBuild(srcDir, buildCmd, onLog);
}
