import {
  frontendBaseUrl,
  buildActivationLink,
  buildResetPasswordLink,
  buildUnsubscribeLink,
  buildStudentSubjectLink,
} from './frontend-links';

const PROD_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  FRONTEND_URL: 'https://www.projtrack.codes',
};

const DEV_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  APP_ENV: 'development',
};

function withEnv(env: NodeJS.ProcessEnv, fn: () => void): void {
  const saved = { ...process.env };
  Object.keys(process.env).forEach((k) => { delete (process.env as any)[k]; });
  Object.assign(process.env, env);
  try {
    fn();
  } finally {
    Object.keys(process.env).forEach((k) => { delete (process.env as any)[k]; });
    Object.assign(process.env, saved);
  }
}

describe('frontendBaseUrl', () => {
  it('returns FRONTEND_URL when set', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'https://www.projtrack.codes' }, () => {
      expect(frontendBaseUrl()).toBe('https://www.projtrack.codes');
    });
  });

  it('strips trailing slashes', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'https://www.projtrack.codes///' }, () => {
      expect(frontendBaseUrl()).toBe('https://www.projtrack.codes');
    });
  });

  it('falls back to APP_URL when FRONTEND_URL is unset', () => {
    withEnv({ NODE_ENV: 'development', APP_ENV: 'development', APP_URL: 'http://localhost:5173' }, () => {
      expect(frontendBaseUrl()).toBe('http://localhost:5173');
    });
  });

  it('falls back to localhost:5173 in development when neither is set', () => {
    withEnv(DEV_ENV, () => {
      expect(frontendBaseUrl()).toBe('http://localhost:5173');
    });
  });

  it('throws in production when FRONTEND_URL is not set', () => {
    withEnv({ NODE_ENV: 'production', APP_ENV: 'production' }, () => {
      expect(() => frontendBaseUrl()).toThrow('FRONTEND_URL is required in production');
    });
  });

  it('throws in production when FRONTEND_URL is http://localhost (https check fires first)', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'http://localhost:5173' }, () => {
      expect(() => frontendBaseUrl()).toThrow('must use https://');
    });
  });

  it('throws in production when FRONTEND_URL is https://localhost (localhost check fires)', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'https://localhost:5173' }, () => {
      expect(() => frontendBaseUrl()).toThrow('cannot point to localhost');
    });
  });

  it('throws in production when FRONTEND_URL is http://127.0.0.1 (https check fires first)', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'http://127.0.0.1:5173' }, () => {
      expect(() => frontendBaseUrl()).toThrow('must use https://');
    });
  });

  it('throws in production when FRONTEND_URL is https://127.0.0.1 (localhost check fires)', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'https://127.0.0.1:5173' }, () => {
      expect(() => frontendBaseUrl()).toThrow('cannot point to localhost');
    });
  });

  it('throws in production when FRONTEND_URL uses http instead of https', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'http://www.projtrack.codes' }, () => {
      expect(() => frontendBaseUrl()).toThrow('must use https://');
    });
  });

  it('throws in production when FRONTEND_URL is not a valid URL', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'not-a-url' }, () => {
      expect(() => frontendBaseUrl()).toThrow('not a valid absolute URL');
    });
  });
});

describe('buildActivationLink', () => {
  it('produces correct HTTPS link in production', () => {
    withEnv(PROD_ENV, () => {
      const link = buildActivationLink({ token: 'tok', ref: 'ref123', role: 'ADMIN' });
      expect(link).toMatch(/^https:\/\/www\.projtrack\.codes\/auth\/activate\?/);
      expect(link).toContain('token=tok');
      expect(link).toContain('ref=ref123');
      expect(link).toContain('role=admin');
    });
  });

  it('lowercases the role in the URL', () => {
    withEnv(PROD_ENV, () => {
      const link = buildActivationLink({ token: 't', ref: 'r', role: 'STUDENT' });
      expect(link).toContain('role=student');
    });
  });

  it('throws in production if FRONTEND_URL is localhost', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'http://localhost:5173' }, () => {
      expect(() => buildActivationLink({ token: 't', ref: 'r', role: 'admin' })).toThrow();
    });
  });
});

describe('buildResetPasswordLink', () => {
  it('produces correct HTTPS link in production', () => {
    withEnv(PROD_ENV, () => {
      const link = buildResetPasswordLink({ token: 'tok', ref: 'ref123', role: 'TEACHER' });
      expect(link).toMatch(/^https:\/\/www\.projtrack\.codes\/auth\/reset-password\?/);
      expect(link).toContain('token=tok');
      expect(link).toContain('ref=ref123');
      expect(link).toContain('role=teacher');
    });
  });

  it('does not include mode param when mode is undefined', () => {
    withEnv(PROD_ENV, () => {
      const link = buildResetPasswordLink({ token: 't', ref: 'r', role: 'admin' });
      expect(link).not.toContain('mode=');
    });
  });

  it('includes mode param when provided', () => {
    withEnv(PROD_ENV, () => {
      const link = buildResetPasswordLink({ token: 't', ref: 'r', role: 'admin', mode: 'setup' });
      expect(link).toContain('mode=setup');
    });
  });

  it('never produces a localhost link in production', () => {
    withEnv({ ...PROD_ENV, FRONTEND_URL: 'https://www.projtrack.codes' }, () => {
      const link = buildResetPasswordLink({ token: 'tok', ref: 'ref123', role: 'admin' });
      expect(link).not.toContain('localhost');
      expect(link).not.toContain('127.0.0.1');
    });
  });
});

describe('buildUnsubscribeLink', () => {
  it('produces correct HTTPS unsubscribe link', () => {
    withEnv(PROD_ENV, () => {
      const link = buildUnsubscribeLink('unsubtoken123');
      expect(link).toMatch(/^https:\/\/www\.projtrack\.codes\/unsubscribe\?/);
      expect(link).toContain('token=unsubtoken123');
    });
  });
});

describe('buildStudentSubjectLink', () => {
  it('produces correct HTTPS subject link', () => {
    withEnv(PROD_ENV, () => {
      const link = buildStudentSubjectLink('subject-abc');
      expect(link).toBe('https://www.projtrack.codes/student/subjects/subject-abc');
    });
  });

  it('URL-encodes subject IDs with special characters', () => {
    withEnv(PROD_ENV, () => {
      const link = buildStudentSubjectLink('id with spaces');
      expect(link).toContain('id%20with%20spaces');
    });
  });
});
