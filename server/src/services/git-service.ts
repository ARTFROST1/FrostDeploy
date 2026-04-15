import { execCommand } from '../lib/exec.js';

const GITHUB_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/;
const SHA_RE = /^[0-9a-f]{40}$/;

interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

interface CacheEntry {
  data: CommitInfo[];
  etag: string | null;
  timestamp: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return { owner: match[1]!, repo: match[2]! };
}

export async function getCommits(
  repoUrl: string,
  branch: string,
  pat?: string,
): Promise<CommitInfo[]> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const cacheKey = `${owner}/${repo}:${branch}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=15`;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FrostDeploy/0.1',
  };

  if (pat) {
    headers['Authorization'] = `Bearer ${pat}`;
  }

  // Conditional request if we have a stale etag
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  const response = await fetch(apiUrl, { headers });

  if (response.status === 304 && cached) {
    cached.timestamp = Date.now();
    return cached.data;
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as Array<{
    sha: string;
    commit: {
      message: string;
      author: { name: string; date: string };
    };
  }>;

  const commits: CommitInfo[] = body.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split('\n')[0]!,
    author: c.commit.author.name,
    date: c.commit.author.date,
  }));

  const etag = response.headers.get('etag');
  cache.set(cacheKey, { data: commits, etag, timestamp: Date.now() });

  return commits;
}

export async function cloneRepo(
  repoUrl: string,
  pat: string | undefined,
  targetDir: string,
): Promise<void> {
  if (!GITHUB_URL_RE.test(repoUrl)) {
    throw new Error('Invalid repository URL: only GitHub HTTPS URLs are supported');
  }

  let cloneUrl = repoUrl;
  if (pat) {
    cloneUrl = repoUrl.replace('https://', `https://${pat}@`);
  }

  await execCommand('git', ['clone', cloneUrl, targetDir], {
    timeout: 300_000,
  });
}

export async function fetchOrigin(srcDir: string, pat?: string): Promise<void> {
  if (pat) {
    // Update remote URL with PAT for private repos
    const result = await execCommand('git', ['remote', 'get-url', 'origin'], { cwd: srcDir });
    const currentUrl = result.stdout.trim();
    const cleanUrl = currentUrl.replace(/^https:\/\/[^@]*@/, 'https://');
    const authedUrl = cleanUrl.replace('https://', `https://${pat}@`);
    await execCommand('git', ['remote', 'set-url', 'origin', authedUrl], { cwd: srcDir });
  }
  await execCommand('git', ['fetch', 'origin'], { cwd: srcDir });
}

export async function checkoutSha(srcDir: string, sha: string): Promise<void> {
  if (!SHA_RE.test(sha)) {
    throw new Error(`Invalid commit SHA: ${sha}`);
  }

  await execCommand('git', ['checkout', sha], { cwd: srcDir });
}
