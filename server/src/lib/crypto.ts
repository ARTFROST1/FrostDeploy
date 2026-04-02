import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from 'node:crypto';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function hashPassword(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export function verifyPassword(plain: string, hash: string): boolean {
  const hashed = hashPassword(plain);
  const a = Buffer.from(hashed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signSession(payload: object, secret: string): string {
  const data = { ...payload, iat: Date.now() };
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySession(token: string, secret: string): Record<string, unknown> | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;

  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as Record<
      string,
      unknown
    >;
    const iat = payload['iat'];
    if (typeof iat !== 'number') return null;
    if (Date.now() - iat > SESSION_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function deriveKey(key: string): Buffer {
  // Derive exactly 32 bytes from the hex key string via SHA-256
  return createHash('sha256').update(key).digest();
}

export function encrypt(plaintext: string, key: string): string {
  const derivedKey = deriveKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${encrypted.toString('base64')}.${tag.toString('base64')}`;
}

export function decrypt(encrypted: string, key: string): string {
  const parts = encrypted.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivB64, ciphertextB64, tagB64] = parts as [string, string, string];
  const derivedKey = deriveKey(key);
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
