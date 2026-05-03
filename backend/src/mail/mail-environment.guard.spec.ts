import {
  assertCanSendToRecipient,
  getProductionEmailConfigErrors,
  isProductionEmailEnvironment,
  isTestmailAddress,
  isTestmailEnabled,
  resolveEmailRecipient,
  validateProductionEmailConfig,
} from './mail-environment.guard';

function prodEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    APP_ENV: 'production',
    MAIL_PROVIDER: 'mailrelay',
    TESTMAIL_ENABLED: 'false',
    ...extra,
  };
}

describe('isProductionEmailEnvironment', () => {
  it('detects production via NODE_ENV', () => {
    expect(isProductionEmailEnvironment({ NODE_ENV: 'production' } as any)).toBe(true);
  });
  it('detects production via APP_ENV', () => {
    expect(isProductionEmailEnvironment({ APP_ENV: 'production' } as any)).toBe(true);
  });
  it('treats an empty environment as non-production', () => {
    expect(isProductionEmailEnvironment({} as any)).toBe(false);
  });
});

describe('isTestmailEnabled', () => {
  it.each(['1', 'true', 'TRUE', 'yes', 'on'])('accepts "%s"', (v) => {
    expect(isTestmailEnabled({ TESTMAIL_ENABLED: v } as any)).toBe(true);
  });
  it.each(['0', 'false', '', undefined])('treats "%s" as disabled', (v) => {
    expect(isTestmailEnabled({ TESTMAIL_ENABLED: v as any } as any)).toBe(false);
  });
});

describe('isTestmailAddress', () => {
  it('detects testmail.app inboxes case-insensitively', () => {
    expect(isTestmailAddress('USER.NAMESPACE@inbox.testmail.app')).toBe(true);
    expect(isTestmailAddress(' user@inbox.testmail.app ')).toBe(true);
  });
  it('rejects non-testmail addresses', () => {
    expect(isTestmailAddress('user@projtrack.codes')).toBe(false);
    expect(isTestmailAddress('user@inbox.example.com')).toBe(false);
  });
});

describe('assertCanSendToRecipient', () => {
  it('throws in production when sending to a testmail.app address', () => {
    expect(() => assertCanSendToRecipient('user@inbox.testmail.app', prodEnv())).toThrow(
      /Blocked testmail recipient in production/,
    );
  });
  it('does not throw in production for a regular recipient', () => {
    expect(() => assertCanSendToRecipient('user@projtrack.codes', prodEnv())).not.toThrow();
  });
  it('does not throw in development for a testmail recipient', () => {
    expect(() =>
      assertCanSendToRecipient('user@inbox.testmail.app', { NODE_ENV: 'development' } as any),
    ).not.toThrow();
  });
});

describe('getProductionEmailConfigErrors', () => {
  it('returns no errors for a clean production config', () => {
    expect(getProductionEmailConfigErrors(prodEnv())).toEqual([]);
  });

  it('returns no errors when not in production', () => {
    expect(getProductionEmailConfigErrors({ NODE_ENV: 'development' } as any)).toEqual([]);
  });

  it('rejects TESTMAIL_ENABLED truthy in production', () => {
    const errs = getProductionEmailConfigErrors(prodEnv({ TESTMAIL_ENABLED: 'true' }));
    expect(errs.join(' | ')).toMatch(/TESTMAIL_ENABLED must be false/);
  });

  it('rejects providers other than mailrelay in production', () => {
    expect(getProductionEmailConfigErrors(prodEnv({ MAIL_PROVIDER: 'stub' })).join('|'))
      .toMatch(/MAIL_PROVIDER must be mailrelay/);
    expect(getProductionEmailConfigErrors(prodEnv({ MAIL_PROVIDER: 'resend' })).join('|'))
      .toMatch(/MAIL_PROVIDER must be mailrelay/);
    expect(getProductionEmailConfigErrors(prodEnv({ MAIL_PROVIDER: 'sender' })).join('|'))
      .toMatch(/MAIL_PROVIDER must be mailrelay/);
  });

  it('rejects forbidden TEST_EMAIL_* env vars in production', () => {
    const errs = getProductionEmailConfigErrors(
      prodEnv({
        TEST_EMAIL_ACTIVATION: 'a@inbox.testmail.app',
        TESTMAIL_API_KEY: 'tm-key',
      }),
    );
    expect(errs.some((e) => /TEST_EMAIL_ACTIVATION/.test(e))).toBe(true);
    expect(errs.some((e) => /TESTMAIL_API_KEY/.test(e))).toBe(true);
  });
});

describe('validateProductionEmailConfig', () => {
  it('throws an aggregated message when production config is invalid', () => {
    expect(() =>
      validateProductionEmailConfig(prodEnv({ MAIL_PROVIDER: 'stub', TESTMAIL_ENABLED: 'true' })),
    ).toThrow(/TESTMAIL_ENABLED.*MAIL_PROVIDER|MAIL_PROVIDER.*TESTMAIL_ENABLED/);
  });
  it('does not throw for a clean production config', () => {
    expect(() => validateProductionEmailConfig(prodEnv())).not.toThrow();
  });
});

describe('resolveEmailRecipient', () => {
  it('returns the original recipient in production', () => {
    expect(resolveEmailRecipient('USER@projtrack.codes', 'activation', prodEnv())).toBe(
      'user@projtrack.codes',
    );
  });

  it('blocks a testmail recipient in production', () => {
    expect(() =>
      resolveEmailRecipient('user@inbox.testmail.app', 'activation', prodEnv()),
    ).toThrow(/Blocked testmail recipient/);
  });

  it('returns the original recipient in development when testmail routing is disabled', () => {
    expect(
      resolveEmailRecipient('user@projtrack.codes', 'activation', {
        NODE_ENV: 'development',
        TESTMAIL_ENABLED: 'false',
      } as any),
    ).toBe('user@projtrack.codes');
  });

  it('routes to the per-type test inbox in development when testmail routing is enabled', () => {
    expect(
      resolveEmailRecipient('user@projtrack.codes', 'activation', {
        NODE_ENV: 'development',
        TESTMAIL_ENABLED: 'true',
        TEST_EMAIL_ACTIVATION: 'a@inbox.testmail.app',
        TEST_EMAIL_PASSWORD_RESET: 'pr@inbox.testmail.app',
      } as any),
    ).toBe('a@inbox.testmail.app');

    expect(
      resolveEmailRecipient('user@projtrack.codes', 'password_reset', {
        NODE_ENV: 'development',
        TESTMAIL_ENABLED: 'true',
        TEST_EMAIL_ACTIVATION: 'a@inbox.testmail.app',
        TEST_EMAIL_PASSWORD_RESET: 'pr@inbox.testmail.app',
      } as any),
    ).toBe('pr@inbox.testmail.app');
  });

  it('falls back to the original recipient when no test inbox is configured for the type', () => {
    expect(
      resolveEmailRecipient('user@projtrack.codes', 'notification', {
        NODE_ENV: 'development',
        TESTMAIL_ENABLED: 'true',
      } as any),
    ).toBe('user@projtrack.codes');
  });
});
