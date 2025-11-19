import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { customType } from 'drizzle-orm/pg-core';

function getKey() {
  const keyHex = process.env.CRYPTO_SECRET;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'CRYPTO_SECRET must be a 64-character hex string (32 bytes).',
    );
  }
  return Buffer.from(keyHex, 'hex');
}

function encrypt(value: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(base64: string): string {
  const key = getKey();
  const payload = Buffer.from(base64, 'base64');

  const iv = payload.slice(0, 12);
  const authTag = payload.slice(12, 28);
  const encrypted = payload.slice(28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

export const encryptedText = customType<{ data: string }>({
  dataType() {
    return 'text';
  },
  fromDriver(value: unknown) {
    return decrypt(String(value));
  },
  toDriver(value: string) {
    return encrypt(value);
  },
});
