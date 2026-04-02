import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  onLog?: (line: string) => void;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

export function execCommand(
  cmd: string,
  args: string[],
  options?: ExecOptions,
): Promise<ExecResult> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options?.cwd,
      env: options?.env ? { ...process.env, ...options.env } : undefined,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    if (options?.onLog && child.stdout) {
      const rl = createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        stdoutChunks.push(line);
        options.onLog!(line);
      });
    } else {
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk.toString());
      });
    }

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
      if (options?.onLog) {
        options.onLog(chunk.toString().trimEnd());
      }
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeout);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to execute ${cmd}: ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (timedOut) {
        reject(new Error(`Command timed out after ${timeout}ms: ${cmd} ${args.join(' ')}`));
        return;
      }

      const exitCode = code ?? 1;
      const stdout = stdoutChunks.join(options?.onLog ? '\n' : '');
      const stderr = stderrChunks.join('');

      if (exitCode !== 0) {
        const lastLines = stderr.trim().split('\n').slice(-20).join('\n');
        reject(
          new Error(`Command failed (exit ${exitCode}): ${cmd} ${args.join(' ')}\n${lastLines}`),
        );
        return;
      }

      resolve({ stdout, stderr, exitCode });
    });
  });
}
