import { describe, it, expect } from 'vitest';
import { createProjectSchema, updateProjectSchema } from '../project';

describe('createProjectSchema', () => {
  it('should validate correct input', () => {
    const input = {
      repoUrl: 'https://github.com/user/repo',
      branch: 'main',
      name: 'my-project',
    };
    const result = createProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject invalid repo URL', () => {
    const input = {
      repoUrl: 'not-a-url',
      branch: 'main',
      name: 'my-project',
    };
    const result = createProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = createProjectSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('should reject invalid project name', () => {
    const input = {
      repoUrl: 'https://github.com/user/repo',
      name: 'Invalid Name!',
    };
    const result = createProjectSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should accept optional fields', () => {
    const input = {
      repoUrl: 'https://github.com/user/repo',
      name: 'my-project',
      domain: 'example.com',
      envVars: [{ key: 'DB_URL', value: 'sqlite:memory', isSecret: true }],
    };
    const result = createProjectSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('createProjectSchema — systemd fields', () => {
  const baseProject = {
    repoUrl: 'https://github.com/user/repo',
    name: 'my-app',
  };

  it('accepts a valid extraPath', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      extraPath: '/home/deploy/.deno/bin',
    });
    expect(result.success).toBe(true);
  });

  it('rejects extraPath with spaces', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      extraPath: '/home/deploy/my path',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid Unix username', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      runUser: 'deploy',
    });
    expect(result.success).toBe(true);
  });

  it('rejects runUser starting with a number', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      runUser: '0deploy',
    });
    expect(result.success).toBe(false);
  });

  it('rejects runUser with spaces', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      runUser: 'my user',
    });
    expect(result.success).toBe(false);
  });

  it('accepts limitNofile in valid range', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      limitNofile: 65536,
    });
    expect(result.success).toBe(true);
  });

  it('rejects limitNofile below 1024', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      limitNofile: 512,
    });
    expect(result.success).toBe(false);
  });

  it('rejects limitNofile above 1048576', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      limitNofile: 2000000,
    });
    expect(result.success).toBe(false);
  });

  it('creates project without any systemd fields', () => {
    const result = createProjectSchema.safeParse(baseProject);
    expect(result.success).toBe(true);
  });

  it('accepts extraPath with colons for multiple dirs', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      extraPath: '/opt/bin:/home/deploy/.local/bin',
    });
    expect(result.success).toBe(true);
  });

  it('accepts runUser starting with underscore', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      runUser: '_www',
    });
    expect(result.success).toBe(true);
  });

  it('accepts limitNofile at exactly 1024', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      limitNofile: 1024,
    });
    expect(result.success).toBe(true);
  });

  it('accepts limitNofile at exactly 1048576', () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      limitNofile: 1048576,
    });
    expect(result.success).toBe(true);
  });
});

describe('updateProjectSchema — systemd fields', () => {
  it('accepts null values to clear fields', () => {
    const result = updateProjectSchema.safeParse({
      extraPath: null,
      runUser: null,
      limitNofile: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid systemd fields on update', () => {
    const result = updateProjectSchema.safeParse({
      extraPath: '/opt/bin',
      runUser: 'deploy',
      limitNofile: 32768,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid extraPath on update', () => {
    const result = updateProjectSchema.safeParse({
      extraPath: '/path with spaces',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid runUser on update', () => {
    const result = updateProjectSchema.safeParse({
      runUser: 'Root User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects out of range limitNofile on update', () => {
    const result = updateProjectSchema.safeParse({
      limitNofile: 100,
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty update object', () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects non-integer limitNofile', () => {
    const result = updateProjectSchema.safeParse({
      limitNofile: 1024.5,
    });
    expect(result.success).toBe(false);
  });
});
