import { eq } from 'drizzle-orm';
import { settings } from '@fd/db';
import type { DbClient } from '@fd/db';
import { encrypt, decrypt } from '../lib/crypto.js';

const MASKED_VALUE = '••••••••';

export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is required');
  return key;
}

export function getSetting(db: DbClient, key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export function getDecryptedSetting(db: DbClient, key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return null;
  if (row.isEncrypted) {
    return decrypt(row.value, getEncryptionKey());
  }
  return row.value;
}

export function setSetting(db: DbClient, key: string, value: string): void {
  db.insert(settings)
    .values({ key, value, isEncrypted: false })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, isEncrypted: false },
    })
    .run();
}

export function setEncryptedSetting(db: DbClient, key: string, plaintext: string): void {
  const encrypted = encrypt(plaintext, getEncryptionKey());
  db.insert(settings)
    .values({ key, value: encrypted, isEncrypted: true })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: encrypted, isEncrypted: true },
    })
    .run();
}

export function getAllSettings(db: DbClient): Record<string, string> {
  const rows = db.select().from(settings).all();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.isEncrypted ? MASKED_VALUE : row.value;
  }
  return result;
}

export function isSetupCompleted(db: DbClient): boolean {
  return getSetting(db, 'setup_completed') === 'true';
}
