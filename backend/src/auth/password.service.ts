import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

@Injectable()
export class PasswordService {
  assertStrongPassword(password: string, fieldName = 'Password') {
    const value = String(password ?? '');
    if (value.length < 12) {
      throw new BadRequestException(`${fieldName} must be at least 12 characters long.`);
    }
    if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
      throw new BadRequestException(`${fieldName} must include uppercase, lowercase, number, and special character.`);
    }
    if (/\s/.test(value)) {
      throw new BadRequestException(`${fieldName} must not contain spaces.`);
    }
  }

  hash(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${derived}`;
  }

  compare(password: string, stored?: string | null) {
    if (!stored) return false;
    if (!stored.startsWith('scrypt:')) {
      return false;
    }

    const [, salt, hashed] = stored.split(':');
    const candidate = scryptSync(password, salt, 64);
    const target = Buffer.from(hashed, 'hex');
    return candidate.length === target.length && timingSafeEqual(candidate, target);
  }

  needsRehash(stored?: string | null) {
    if (!stored) return true;
    return !stored.startsWith('scrypt:');
  }
}
