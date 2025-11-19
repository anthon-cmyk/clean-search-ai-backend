import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { customType } from 'drizzle-orm/pg-core';

const keyHex = process.env.CRYPTO_SECRET; // 64 hex chars
if (!keyHex || keyHex.length !== 64) {
  throw new Error(
    'CRYPTO_SECRET must be a 64-character hex string (32 bytes).',
  );
}

const key = Buffer.from(keyHex, 'hex'); // AES-256 key

function encrypt(value: string): string {
  const iv = randomBytes(12); // Recommended GCM IV length
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, authTag, encrypted]);
  return payload.toString('base64');
}

function decrypt(base64: string): string {
  const payload = Buffer.from(base64, 'base64');

  const iv = payload.slice(0, 12);
  const authTag = payload.slice(12, 28);
  const encrypted = payload.slice(28);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
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
