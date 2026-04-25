import { createHash } from 'crypto';

export function hashAccountToken(token: string) {
  return createHash('sha256')
    .update(String(token ?? '').trim())
    .digest('hex');
}
