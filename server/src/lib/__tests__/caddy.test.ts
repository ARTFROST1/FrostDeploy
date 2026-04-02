import { describe, it, expect } from 'vitest';
import {
  generateRouteConfig,
  generateLogConfig,
  validateConfig,
  reloadCaddy,
  getCaddyStatus,
  generateBaseCaddyfile,
} from '../caddy';

describe('generateRouteConfig', () => {
  it('generates reverse_proxy config for SSR project', async () => {
    const route = await generateRouteConfig('example.com', 4321, false);
    expect(route['@id']).toBe('route-example.com');
    expect(route.match[0].host).toEqual(['example.com']);
    expect(route.handle).toHaveLength(2);
    expect(route.handle[0]).toEqual({ handler: 'encode', encodings: { gzip: {}, zstd: {} } });
    expect(route.handle[1]).toMatchObject({
      handler: 'reverse_proxy',
      upstreams: [{ dial: '127.0.0.1:4321' }],
    });
    expect(route.terminal).toBe(true);
  });

  it('generates file_server config for static project', async () => {
    const route = await generateRouteConfig('static.com', 0, true, '/var/www/blog', 'dist');
    expect(route.handle[1]).toMatchObject({ handler: 'file_server', root: '/var/www/blog/dist' });
  });

  it('defaults outputDir to dist for static project', async () => {
    const route = await generateRouteConfig('static.com', 0, true, '/var/www/blog');
    expect(route.handle[1]).toMatchObject({ handler: 'file_server', root: '/var/www/blog/dist' });
  });

  it('throws when runtimeDir missing for static project', async () => {
    await expect(generateRouteConfig('static.com', 0, true)).rejects.toThrow(
      'runtimeDir is required',
    );
  });

  it('includes encode gzip/zstd in all configs', async () => {
    const route = await generateRouteConfig('test.com', 3000, false);
    const encoder = route.handle[0];
    expect(encoder).toEqual({ handler: 'encode', encodings: { gzip: {}, zstd: {} } });
  });
});

describe('generateLogConfig', () => {
  it('generates log config with sanitized domain', async () => {
    const log = await generateLogConfig('app.example.com');
    expect(log.writer.filename).toBe('/var/log/caddy/app-example-com-access.log');
    expect(log.writer.roll_size_mb).toBe(50);
    expect(log.writer.roll_keep).toBe(5);
    expect(log.encoder.format).toBe('json');
    expect(log.include[0]).toBe('http.log.access.access-app-example-com');
  });
});

describe('validateConfig (macOS stub)', () => {
  it('returns true on macOS', async () => {
    const result = await validateConfig();
    expect(result).toBe(true);
  });
});

describe('reloadCaddy (macOS stub)', () => {
  it('returns { success: true } on macOS', async () => {
    const result = await reloadCaddy();
    expect(result).toEqual({ success: true });
  });
});

describe('getCaddyStatus (macOS stub)', () => {
  it('returns inactive on macOS', async () => {
    const result = await getCaddyStatus();
    expect(result).toBe('inactive');
  });
});

describe('generateBaseCaddyfile', () => {
  it('renders Caddyfile with platform domain and port', async () => {
    const result = await generateBaseCaddyfile('deploy.example.com', 9000);
    expect(result).toContain('deploy.example.com');
    expect(result).toContain('127.0.0.1:9000');
    expect(result).toContain('admin localhost:2019');
    expect(result).toContain('encode gzip zstd');
  });
});
