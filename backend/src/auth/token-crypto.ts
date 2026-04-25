import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { hashAccountToken } from './account-token.util';

function encryptionKey() {
  const configured = String(process.env.ACCOUNT_ACTION_TOKEN_ENC_KEY || '').trim();
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ACCOUNT_ACTION_TOKEN_ENC_KEY is required in production.');
    }
    return createHash('sha256')
      .update('projtrack-local-account-action-token-key')
      .digest();
  }

  if (/^[a-f0-9]{64}$/i.test(configured)) return Buffer.from(configured, 'hex');

  const decoded = Buffer.from(configured, 'base64');
  if (decoded.length === 32) return decoded;

  return createHash('sha256').update(configured).digest();
}

export function createRawAccountActionToken(prefix: 'reset' | 'activation') {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

export function createPublicAccountActionRef(prefix: 'rst' | 'act') {
  return `${prefix}_${randomBytes(18).toString('base64url')}`;
}

export function encryptAccountActionToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptAccountActionToken(value: string) {
  const [ivRaw, authTagRaw, ciphertextRaw] = String(value || '').split('.');
  if (!ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error('Encrypted account action token is malformed.');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(authTagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function accountActionTokenHash(token: string) {
  return hashAccountToken(token);
}

export function safeCompareTokenHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
