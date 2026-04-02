import { randomBytes } from 'node:crypto';

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}
