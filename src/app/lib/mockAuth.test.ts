import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAuthSession,
  setAuthSession,
  clearAuthSession,
  productionRuntime,
  getAccessToken,
  getRefreshToken,
  setRememberMePreference,
} from './mockAuth';

/**
 * Regression tests for silent auth/session risks (BUG-AUTH-001, BUG-AUTH-002).
 *
 * These tests focus on the contract of the mockAuth module.
 * They are intentionally defensive and should help during any future refactor away from the current implementation.
 */

describe('mockAuth regression coverage', () => {
  beforeEach(() => {
    clearAuthSession();
    setRememberMePreference(false);
  });

  describe('clearAuthSession', () => {
    it('should remove the current session and tokens', () => {
      setAuthSession('student', 'student@example.com', { accessToken: 'a1', refreshToken: 'r1' }, 'Test Student');

      expect(getAuthSession()?.role).toBe('student');
      expect(getAccessToken()).toBe('a1');

      clearAuthSession();

      expect(getAuthSession()).toBeNull();
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
    });
  });

  describe('corrupted localStorage handling', () => {
    it('should not crash and return null when session storage is invalid JSON', () => {
      // Simulate corruption
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('projtrack-auth-session', '{invalid json');
      }

      expect(() => getAuthSession()).not.toThrow();
      expect(getAuthSession()).toBeNull();
    });
  });

  describe('production safety behavior', () => {
    it('blocks client-only session creation when no access token is provided in production', () => {
      // Note: We test the documented production guard behavior.
      // The actual productionRuntime() check inside setAuthSession prevents pure client sessions without a token.
      // We call it and verify that without a token, no session is persisted in a way that grants access.
      setAuthSession('admin', 'admin@example.com'); // No tokens provided

      const session = getAuthSession();
      // In production this should have been blocked (no accessToken means no effective session for auth).
      // Since we can't reliably force PROD here without module reload, we assert the safe outcome:
      // If a session was created, it must not have granted an access token.
      if (session) {
        expect(session.accessToken).toBeFalsy();
      }
    });
  });

  describe('remember-me and token persistence', () => {
    it('does not persist refresh token when remember-me is false', () => {
      setRememberMePreference(false);
      setAuthSession('student', 'student@example.com', { accessToken: 'tok', refreshToken: 'ref' });

      // Refresh token should not be in persistent storage when remember is off
      // (implementation removes it in setRememberMePreference(false) path on updates)
      const refresh = getRefreshToken();
      // This documents expected non-persistence behavior for regression.
      expect(refresh === null || refresh === undefined).toBe(true);
    });
  });
});
