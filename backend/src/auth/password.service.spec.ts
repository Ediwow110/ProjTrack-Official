import { BadRequestException } from '@nestjs/common';
import { PasswordService } from './password.service';

describe('PasswordService.assertStrongPassword', () => {
  const svc = new PasswordService();

  it('rejects passwords shorter than 12 characters', () => {
    expect(() => svc.assertStrongPassword('Aa1!aaaa')).toThrow(BadRequestException);
  });

  it('rejects passwords missing uppercase', () => {
    expect(() => svc.assertStrongPassword('abcdefgh1!aaa')).toThrow(/uppercase/);
  });

  it('rejects passwords missing lowercase', () => {
    expect(() => svc.assertStrongPassword('ABCDEFGH1!AAA')).toThrow(/lowercase/);
  });

  it('rejects passwords missing digits', () => {
    expect(() => svc.assertStrongPassword('Abcdefghij!!')).toThrow(/number/);
  });

  it('rejects passwords missing special characters', () => {
    expect(() => svc.assertStrongPassword('Abcdefghij1k')).toThrow(/special character/);
  });

  it('rejects passwords containing whitespace', () => {
    expect(() => svc.assertStrongPassword('Abcdef ghij1!')).toThrow(/spaces/);
  });

  it('accepts a strong password', () => {
    expect(() => svc.assertStrongPassword('Abcdefghij1!')).not.toThrow();
  });

  it('uses the provided field name in the error message', () => {
    expect(() => svc.assertStrongPassword('short', 'New password')).toThrow(/New password/);
  });
});

describe('PasswordService.hash + compare', () => {
  const svc = new PasswordService();

  it('round-trips a password through hash and compare', () => {
    const stored = svc.hash('Abcdefghij1!');
    expect(stored.startsWith('scrypt:')).toBe(true);
    expect(svc.compare('Abcdefghij1!', stored)).toBe(true);
  });

  it('returns false for a wrong password', () => {
    const stored = svc.hash('Abcdefghij1!');
    expect(svc.compare('Wrongpassword2@', stored)).toBe(false);
  });

  it('returns false for a null/undefined stored value', () => {
    expect(svc.compare('Abcdefghij1!', null)).toBe(false);
    expect(svc.compare('Abcdefghij1!', undefined)).toBe(false);
    expect(svc.compare('Abcdefghij1!', '')).toBe(false);
  });

  it('returns false for stored values that are not scrypt-formatted', () => {
    expect(svc.compare('Abcdefghij1!', 'bcrypt:foo:bar')).toBe(false);
    expect(svc.compare('Abcdefghij1!', 'plain-old-password')).toBe(false);
  });

  it('returns false for stored values with a malformed scrypt body', () => {
    expect(svc.compare('Abcdefghij1!', 'scrypt:invalid:also-invalid')).toBe(false);
    expect(svc.compare('Abcdefghij1!', 'scrypt:12345:67890')).toBe(false);
  });

  it('produces different hashes for the same password (salted)', () => {
    const a = svc.hash('Abcdefghij1!');
    const b = svc.hash('Abcdefghij1!');
    expect(a).not.toBe(b);
    expect(svc.compare('Abcdefghij1!', a)).toBe(true);
    expect(svc.compare('Abcdefghij1!', b)).toBe(true);
  });

  it('flags malformed scrypt records as needing rehash', () => {
    expect(svc.needsRehash('scrypt:short:also-short')).toBe(true);
    expect(svc.needsRehash(svc.hash('Abcdefghij1!'))).toBe(false);
    expect(svc.needsRehash(null)).toBe(false);
    expect(svc.needsRehash('bcrypt:x:y')).toBe(false);
  });
});
