import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ejs from 'ejs';

const templatePath = join(import.meta.dirname, '..', '..', 'templates', 'systemd.service.ejs');
const template = readFileSync(templatePath, 'utf-8');

function renderUnit(overrides: Record<string, unknown> = {}): string {
  const defaults = {
    name: 'testapp',
    runtimeDir: '/var/www/testapp',
    port: 4322,
    envFilePath: null,
    cpuQuota: null,
    memoryMax: null,
    extraPath: null,
    runUser: null,
    limitNofile: null,
  };
  return ejs.render(template, { ...defaults, ...overrides });
}

describe('systemd.service.ejs template', () => {
  // 1. Default rendering
  it('renders User=root by default', () => {
    const unit = renderUnit();
    expect(unit).toContain('User=root');
  });

  // 2. Custom runUser
  it('renders custom runUser', () => {
    const unit = renderUnit({ runUser: 'deploy' });
    expect(unit).toContain('User=deploy');
    expect(unit).not.toContain('User=root');
  });

  // 3. Custom extraPath
  it('prepends extraPath to PATH', () => {
    const unit = renderUnit({ extraPath: '/home/deploy/.deno/bin' });
    expect(unit).toContain(
      'Environment=PATH=/home/deploy/.deno/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    );
  });

  // 4. Both extraPath and default PATH combined
  it('includes both extra and standard PATH segments', () => {
    const unit = renderUnit({ extraPath: '/opt/custom/bin' });
    const match = unit.match(/Environment=PATH=(.+)/);
    expect(match).not.toBeNull();
    const pathValue = match![1]!;
    expect(pathValue.startsWith('/opt/custom/bin:')).toBe(true);
    expect(pathValue).toContain('/usr/local/bin');
    expect(pathValue).toContain('/usr/bin');
  });

  // 5. Custom limitNofile
  it('renders LimitNOFILE when limitNofile is set', () => {
    const unit = renderUnit({ limitNofile: 65536 });
    expect(unit).toContain('LimitNOFILE=65536');
  });

  // 6. All three options together
  it('renders all three new options together', () => {
    const unit = renderUnit({
      runUser: 'deploy',
      extraPath: '/home/deploy/.deno/bin',
      limitNofile: 65536,
    });
    expect(unit).toContain('User=deploy');
    expect(unit).toContain('/home/deploy/.deno/bin:');
    expect(unit).toContain('LimitNOFILE=65536');
  });

  // 7. Null extraPath — no extra path prefix
  it('renders standard PATH when extraPath is null', () => {
    const unit = renderUnit({ extraPath: null });
    expect(unit).toContain(
      'Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    );
  });

  // 8. Null runUser — defaults to root
  it('defaults to root when runUser is null', () => {
    const unit = renderUnit({ runUser: null });
    expect(unit).toContain('User=root');
  });

  // 9. Null limitNofile — no LimitNOFILE line
  it('omits LimitNOFILE when limitNofile is null', () => {
    const unit = renderUnit({ limitNofile: null });
    expect(unit).not.toContain('LimitNOFILE');
  });

  // 10. envFilePath present
  it('renders EnvironmentFile when envFilePath is set', () => {
    const unit = renderUnit({ envFilePath: '/var/lib/frostdeploy/env/testapp.env' });
    expect(unit).toContain('EnvironmentFile=/var/lib/frostdeploy/env/testapp.env');
  });

  // 11. envFilePath absent
  it('omits EnvironmentFile when envFilePath is null', () => {
    const unit = renderUnit({ envFilePath: null });
    expect(unit).not.toContain('EnvironmentFile');
  });

  // 12. cpuQuota present
  it('renders CPUQuota when set', () => {
    const unit = renderUnit({ cpuQuota: '200%' });
    expect(unit).toContain('CPUQuota=200%');
  });

  // 13. memoryMax present
  it('renders MemoryMax when set', () => {
    const unit = renderUnit({ memoryMax: '1G' });
    expect(unit).toContain('MemoryMax=1G');
  });

  // 14. Description contains project name
  it('includes project name in Description', () => {
    const unit = renderUnit({ name: 'myproject' });
    expect(unit).toContain('Description=FrostDeploy: myproject');
  });

  // 15. WorkingDirectory is runtimeDir
  it('sets WorkingDirectory to runtimeDir', () => {
    const unit = renderUnit({ runtimeDir: '/var/www/myapp' });
    expect(unit).toContain('WorkingDirectory=/var/www/myapp');
  });

  // 16. PORT env var matches port
  it('sets PORT environment variable to port', () => {
    const unit = renderUnit({ port: 9999 });
    expect(unit).toContain('Environment=PORT=9999');
  });

  // 17. SyslogIdentifier includes project name
  it('includes project name in SyslogIdentifier', () => {
    const unit = renderUnit({ name: 'frontend' });
    expect(unit).toContain('SyslogIdentifier=frostdeploy-frontend');
  });

  // 18. Restart=on-failure present
  it('sets Restart=on-failure', () => {
    const unit = renderUnit();
    expect(unit).toContain('Restart=on-failure');
  });

  // 19. NODE_ENV=production present
  it('sets NODE_ENV=production', () => {
    const unit = renderUnit();
    expect(unit).toContain('Environment=NODE_ENV=production');
  });

  // 20. [Install] WantedBy=multi-user.target present
  it('includes WantedBy=multi-user.target in [Install]', () => {
    const unit = renderUnit();
    expect(unit).toContain('[Install]');
    expect(unit).toContain('WantedBy=multi-user.target');
  });

  // 21. Extra PATH with special characters
  it('handles extraPath with slashes, dots, and hyphens', () => {
    const unit = renderUnit({ extraPath: '/opt/my-app/.local/bin-v2' });
    expect(unit).toContain('/opt/my-app/.local/bin-v2:/usr/local/sbin');
  });

  // 22. Backward compatibility — only old fields
  it('renders correctly with only old fields (no new fields at all)', () => {
    const oldDefaults = {
      name: 'legacy',
      runtimeDir: '/var/www/legacy',
      port: 3000,
      envFilePath: null,
      cpuQuota: null,
      memoryMax: null,
      extraPath: null,
      runUser: null,
      limitNofile: null,
    };
    const unit = ejs.render(template, oldDefaults);
    expect(unit).toContain('User=root');
    expect(unit).toContain(
      'Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    );
    expect(unit).not.toContain('LimitNOFILE');
    expect(unit).toContain('Description=FrostDeploy: legacy');
    expect(unit).toContain('Environment=PORT=3000');
  });

  // 23. Empty string extraPath treated as falsy
  it('treats empty string extraPath as no extra path', () => {
    const unit = renderUnit({ extraPath: '' });
    expect(unit).toContain(
      'Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    );
  });

  // 24. Empty string runUser falls back to root
  it('treats empty string runUser as root', () => {
    const unit = renderUnit({ runUser: '' });
    expect(unit).toContain('User=root');
  });

  // 25. Zero limitNofile is treated as falsy (no line)
  it('omits LimitNOFILE when limitNofile is 0', () => {
    const unit = renderUnit({ limitNofile: 0 });
    expect(unit).not.toContain('LimitNOFILE');
  });

  // 26. LimitNOFILE appears in [Service] section
  it('places LimitNOFILE in the [Service] section', () => {
    const unit = renderUnit({ limitNofile: 32768 });
    const serviceStart = unit.indexOf('[Service]');
    const installStart = unit.indexOf('[Install]');
    const limitPos = unit.indexOf('LimitNOFILE=32768');
    expect(limitPos).toBeGreaterThan(serviceStart);
    expect(limitPos).toBeLessThan(installStart);
  });

  // 27. Multiple resource limits together
  it('renders cpuQuota, memoryMax, and limitNofile together', () => {
    const unit = renderUnit({ cpuQuota: '150%', memoryMax: '512M', limitNofile: 16384 });
    expect(unit).toContain('CPUQuota=150%');
    expect(unit).toContain('MemoryMax=512M');
    expect(unit).toContain('LimitNOFILE=16384');
  });

  // 28. Type=simple is present
  it('sets Type=simple', () => {
    const unit = renderUnit();
    expect(unit).toContain('Type=simple');
  });

  // 29. RestartSec=5 present
  it('sets RestartSec=5', () => {
    const unit = renderUnit();
    expect(unit).toContain('RestartSec=5');
  });

  // 30. After=network.target present
  it('sets After=network.target in [Unit]', () => {
    const unit = renderUnit();
    expect(unit).toContain('After=network.target');
  });
});
