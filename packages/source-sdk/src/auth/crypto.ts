import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const buildKey = (rawKey: string): Buffer => {
  const asBase64 = Buffer.from(rawKey, 'base64');
  if (asBase64.length === 32) {
    return asBase64;
  }
  return createHash('sha256').update(rawKey).digest();
};

export const createEncryptor = (rawKey: string): ((plain: string) => Buffer) => {
  const key = buildKey(rawKey);
  return (plain: string): Buffer => {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  };
};

export const createDecryptor = (rawKey: string): ((cipherBlob: Buffer) => string) => {
  const key = buildKey(rawKey);
  return (cipherBlob: Buffer): string => {
    const iv = cipherBlob.subarray(0, IV_LENGTH);
    const tag = cipherBlob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = cipherBlob.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString('utf8');
  };
};
