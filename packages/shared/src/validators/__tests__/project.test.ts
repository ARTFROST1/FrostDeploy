import { describe, it, expect } from 'vitest';
import { createProjectSchema } from '../project';

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
