import { BadRequestException } from '@nestjs/common';
import { renderMailTemplate, validateMailTemplatePayload } from './mail.templates';
import { MAIL_TEMPLATE_KEYS } from '../common/constants/mail.constants';

const PROD_ENV_KEYS = { NODE_ENV: 'production', APP_ENV: 'production' };
const DEV_ENV_KEYS = { NODE_ENV: 'development', APP_ENV: 'development' };

function withEnv(overrides: NodeJS.ProcessEnv, fn: () => void): void {
  const saved = { ...process.env };
  Object.keys(process.env).forEach((k) => { delete (process.env as any)[k]; });
  Object.assign(process.env, overrides);
  try {
    fn();
  } finally {
    Object.keys(process.env).forEach((k) => { delete (process.env as any)[k]; });
    Object.assign(process.env, saved);
  }
}

const PROD_RESET_PAYLOAD = {
  firstName: 'Alice',
  resetLink: 'https://www.projtrack.codes/auth/reset-password?token=tok&ref=ref123',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  isFirstTimeSetup: false,
};

const PROD_SETUP_PAYLOAD = {
  firstName: 'Bob',
  resetLink: 'https://www.projtrack.codes/auth/reset-password?token=tok&ref=ref456',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  isFirstTimeSetup: true,
};

const DEV_RESET_PAYLOAD = {
  firstName: 'Dev User',
  resetLink: 'http://localhost:5173/auth/reset-password?token=tok&ref=ref789',
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  isFirstTimeSetup: false,
};

describe('renderMailTemplate — password-reset (standard reset)', () => {
  it('returns subject, html, and text', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, DEV_RESET_PAYLOAD);
      expect(result.subject).toBeTruthy();
      expect(result.html).toBeTruthy();
      expect(result.text).toBeTruthy();
    });
  });

  it('subject contains "Password Reset"', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, DEV_RESET_PAYLOAD);
      expect(result.subject).toMatch(/password reset/i);
    });
  });

  it('HTML contains branded ProjTrack header', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, DEV_RESET_PAYLOAD);
      expect(result.html).toContain('ProjTrack');
    });
  });

  it('HTML contains reset link as both button href and fallback anchor', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, DEV_RESET_PAYLOAD);
      const linkCount = (result.html.match(/localhost:5173\/auth\/reset-password/g) || []).length;
      expect(linkCount).toBeGreaterThanOrEqual(2);
    });
  });

  it('HTML contains "Reset Password" button label', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, DEV_RESET_PAYLOAD);
      expect(result.html).toContain('Reset Password');
    });
  });

  it('plain text contains the reset link', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, DEV_RESET_PAYLOAD);
      expect(result.text).toContain('localhost:5173/auth/reset-password');
    });
  });

  it('plain text contains the expiry notice', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, DEV_RESET_PAYLOAD);
      expect(result.text).toContain('expires');
    });
  });

  it('plain text greets the recipient by first name', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, DEV_RESET_PAYLOAD);
      expect(result.text).toContain('Dev User');
    });
  });
});

describe('renderMailTemplate — password-reset (first-time setup)', () => {
  it('subject contains "Set Up Your Password"', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
        ...DEV_RESET_PAYLOAD,
        isFirstTimeSetup: true,
      });
      expect(result.subject).toMatch(/set up your password/i);
    });
  });

  it('HTML contains "Create Password" button label for first-time setup', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
        ...DEV_RESET_PAYLOAD,
        isFirstTimeSetup: true,
      });
      expect(result.html).toContain('Create Password');
    });
  });

  it('plain text mentions "creating your password" for first-time setup', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
        ...DEV_RESET_PAYLOAD,
        isFirstTimeSetup: true,
      });
      expect(result.text).toContain('creating your password');
    });
  });
});

describe('renderMailTemplate — password-reset in production', () => {
  it('accepts https link in production', () => {
    withEnv(PROD_ENV_KEYS, () => {
      expect(() => renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, PROD_RESET_PAYLOAD)).not.toThrow();
    });
  });

  it('rejects localhost link in production', () => {
    withEnv(PROD_ENV_KEYS, () => {
      expect(() =>
        renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
          ...PROD_RESET_PAYLOAD,
          resetLink: 'http://localhost:5173/auth/reset-password?token=tok',
        }),
      ).toThrow(BadRequestException);
    });
  });

  it('rejects 127.0.0.1 link in production', () => {
    withEnv(PROD_ENV_KEYS, () => {
      expect(() =>
        renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
          ...PROD_RESET_PAYLOAD,
          resetLink: 'http://127.0.0.1:5173/auth/reset-password?token=tok',
        }),
      ).toThrow(BadRequestException);
    });
  });

  it('rejects http (non-HTTPS) link in production', () => {
    withEnv(PROD_ENV_KEYS, () => {
      expect(() =>
        renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
          ...PROD_RESET_PAYLOAD,
          resetLink: 'http://www.projtrack.codes/auth/reset-password?token=tok',
        }),
      ).toThrow(BadRequestException);
    });
  });

  it('password setup email also passes production HTTPS check', () => {
    withEnv(PROD_ENV_KEYS, () => {
      expect(() => renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, PROD_SETUP_PAYLOAD)).not.toThrow();
    });
  });
});

describe('renderMailTemplate — account-activation', () => {
  const activationPayload = {
    firstName: 'Charlie',
    activationUrl: 'https://www.projtrack.codes/auth/activate?token=tok&ref=ref000',
  };

  it('returns subject, html, and text', () => {
    withEnv(PROD_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION, activationPayload);
      expect(result.subject).toBeTruthy();
      expect(result.html).toBeTruthy();
      expect(result.text).toBeTruthy();
    });
  });

  it('subject is "Activate your ProjTrack account"', () => {
    withEnv(PROD_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION, activationPayload);
      expect(result.subject).toBe('Activate your ProjTrack account');
    });
  });

  it('HTML contains "Activate Account" button', () => {
    withEnv(PROD_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION, activationPayload);
      expect(result.html).toContain('Activate Account');
    });
  });

  it('plain text contains the activation link', () => {
    withEnv(PROD_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION, activationPayload);
      expect(result.text).toContain('/auth/activate');
    });
  });
});

describe('renderMailTemplate — email-verification', () => {
  const verificationPayload = {
    firstName: 'Dana',
    verificationLink: 'https://www.projtrack.codes/auth/activate?token=tok&ref=ref111',
  };

  it('subject contains "Email Verification"', () => {
    withEnv(PROD_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION, verificationPayload);
      expect(result.subject).toMatch(/email verification/i);
    });
  });

  it('HTML contains "Verify Email" button', () => {
    withEnv(PROD_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION, verificationPayload);
      expect(result.html).toContain('Verify Email');
    });
  });
});

describe('renderMailTemplate — bulk-invitation', () => {
  const invitationPayload = {
    firstName: 'Eve',
    inviteLink: 'https://www.projtrack.codes/auth/activate?token=tok&ref=ref222',
    role: 'student',
  };

  it('returns html and text', () => {
    withEnv(PROD_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.BULK_INVITATION, invitationPayload);
      expect(result.html).toBeTruthy();
      expect(result.text).toBeTruthy();
    });
  });

  it('HTML contains the invite link', () => {
    withEnv(PROD_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.BULK_INVITATION, invitationPayload);
      expect(result.html).toContain('/auth/activate');
    });
  });
});

describe('renderMailTemplate — broadcast', () => {
  const broadcastPayload = {
    firstName: 'Frank',
    title: 'System Maintenance Tonight',
    body: 'We will be performing maintenance from 2am to 4am.',
  };

  it('returns subject, html, and text', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.BROADCAST, broadcastPayload);
      expect(result.subject).toBe('System Maintenance Tonight');
      expect(result.html).toBeTruthy();
      expect(result.text).toBeTruthy();
    });
  });
});

describe('validateMailTemplatePayload', () => {
  it('throws when resetLink is missing', () => {
    withEnv(DEV_ENV_KEYS, () => {
      expect(() =>
        validateMailTemplatePayload(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
          firstName: 'Alice',
          expiresAt: new Date().toISOString(),
        }),
      ).toThrow(BadRequestException);
    });
  });

  it('throws when expiresAt is missing', () => {
    withEnv(DEV_ENV_KEYS, () => {
      expect(() =>
        validateMailTemplatePayload(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
          firstName: 'Alice',
          resetLink: 'http://localhost:5173/auth/reset-password?token=tok',
        }),
      ).toThrow(BadRequestException);
    });
  });

  it('throws when firstName is missing for account-activation', () => {
    withEnv(DEV_ENV_KEYS, () => {
      expect(() =>
        validateMailTemplatePayload(MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION, {
          activationUrl: 'http://localhost:5173/auth/activate?token=tok',
        }),
      ).toThrow(BadRequestException);
    });
  });

  it('throws when activationUrl is missing for account-activation', () => {
    withEnv(DEV_ENV_KEYS, () => {
      expect(() =>
        validateMailTemplatePayload(MAIL_TEMPLATE_KEYS.ACCOUNT_ACTIVATION, {
          firstName: 'Alice',
        }),
      ).toThrow(BadRequestException);
    });
  });

  it('throws when an unknown template key is used', () => {
    withEnv(DEV_ENV_KEYS, () => {
      expect(() =>
        validateMailTemplatePayload('not-a-real-key', { firstName: 'Alice' }),
      ).toThrow(BadRequestException);
    });
  });

  it('normalises isFirstTimeSetup to a boolean', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = validateMailTemplatePayload(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
        firstName: 'Alice',
        resetLink: 'http://localhost:5173/auth/reset-password?token=tok',
        expiresAt: new Date().toISOString(),
        isFirstTimeSetup: 1 as unknown as boolean,
      });
      expect(typeof result.isFirstTimeSetup).toBe('boolean');
    });
  });
});

describe('renderMailTemplate — HTML safety', () => {
  it('escapes HTML special characters in user-controlled first name', () => {
    withEnv(DEV_ENV_KEYS, () => {
      const result = renderMailTemplate(MAIL_TEMPLATE_KEYS.PASSWORD_RESET, {
        firstName: '<script>alert(1)</script>',
        resetLink: 'http://localhost:5173/auth/reset-password?token=tok',
        expiresAt: new Date().toISOString(),
        isFirstTimeSetup: false,
      });
      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
    });
  });
});
