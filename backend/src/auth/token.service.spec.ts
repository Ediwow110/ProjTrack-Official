import { TokenService } from './token.service';

const SECRET_A = 'token-spec-access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SECRET_B = 'token-spec-refresh-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function freshService(envOverrides: NodeJS.ProcessEnv = {}) {
  process.env.JWT_ACCESS_SECRET = envOverrides.JWT_ACCESS_SECRET ?? SECRET_A;
  process.env.JWT_REFRESH_SECRET = envOverrides.JWT_REFRESH_SECRET ?? SECRET_B;
  process.env.JWT_ISSUER = envOverrides.JWT_ISSUER ?? 'projtrack-api';
  process.env.JWT_AUDIENCE = envOverrides.JWT_AUDIENCE ?? 'projtrack-web';
  process.env.JWT_KEY_ID = envOverrides.JWT_KEY_ID ?? 'spec-1';
  process.env.JWT_ACCESS_TTL_MS = envOverrides.JWT_ACCESS_TTL_MS ?? '60000';
  process.env.JWT_REFRESH_TTL_MS = envOverrides.JWT_REFRESH_TTL_MS ?? '600000';
  return new TokenService();
}

const USER = { id: 'u-1', role: 'ADMIN', email: 'admin@example.com' };

describe('TokenService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws if either secret is missing at construction time', () => {
    delete process.env.JWT_ACCESS_SECRET;
    process.env.JWT_REFRESH_SECRET = SECRET_B;
    expect(() => new TokenService()).toThrow(/JWT_ACCESS_SECRET and JWT_REFRESH_SECRET/);
  });

  it('round-trips an access token', () => {
    const svc = freshService();
    const token = svc.createAccessToken(USER);
    const payload = svc.verifyAccessToken(token);
    expect(payload).toBeTruthy();
    expect(payload.sub).toBe('u-1');
    expect(payload.role).toBe('ADMIN');
    expect(payload.type).toBe('access');
    expect(payload.iss).toBe('projtrack-api');
    expect(payload.aud).toBe('projtrack-web');
  });

  it('round-trips a refresh token and preserves session id and remember flag', () => {
    const svc = freshService();
    const token = svc.createRefreshToken(USER, 'session-xyz', 600_000, true);
    const payload = svc.verifyRefreshToken(token);
    expect(payload).toBeTruthy();
    expect(payload.sid).toBe('session-xyz');
    expect(payload.remember).toBe(true);
    expect(payload.type).toBe('refresh');
  });

  it('returns null when an access token is presented to the refresh verifier', () => {
    const svc = freshService();
    const accessToken = svc.createAccessToken(USER);
    expect(svc.verifyRefreshToken(accessToken)).toBeNull();
  });

  it('returns null when a refresh token is presented to the access verifier', () => {
    const svc = freshService();
    const refreshToken = svc.createRefreshToken(USER, 'sid', 600_000);
    expect(svc.verifyAccessToken(refreshToken)).toBeNull();
  });

  it('returns null for a tampered signature', () => {
    const svc = freshService();
    const token = svc.createAccessToken(USER);
    const [h, b, s] = token.split('.');
    const flippedSig = s.slice(0, -2) + (s.endsWith('aa') ? 'bb' : 'aa');
    expect(svc.verifyAccessToken(`${h}.${b}.${flippedSig}`)).toBeNull();
  });

  it('returns null for a token whose body has been swapped (signature no longer matches)', () => {
    const svc = freshService();
    const token = svc.createAccessToken(USER);
    const [h, _b, s] = token.split('.');
    const evilBody = Buffer.from(JSON.stringify({ sub: 'evil', role: 'ADMIN', type: 'access' })).toString('base64url');
    expect(svc.verifyAccessToken(`${h}.${evilBody}.${s}`)).toBeNull();
  });

  it('returns null for a token signed with a different access secret', () => {
    const a = freshService({ JWT_ACCESS_SECRET: SECRET_A });
    const tokenFromA = a.createAccessToken(USER);
    const b = freshService({ JWT_ACCESS_SECRET: 'completely-different-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxx' });
    expect(b.verifyAccessToken(tokenFromA)).toBeNull();
  });

  it('returns null when the kid does not match the configured key id', () => {
    const a = freshService({ JWT_KEY_ID: 'spec-1' });
    const token = a.createAccessToken(USER);
    const b = freshService({ JWT_KEY_ID: 'spec-2' });
    expect(b.verifyAccessToken(token)).toBeNull();
  });

  it('returns null when the issuer does not match', () => {
    const a = freshService({ JWT_ISSUER: 'projtrack-api' });
    const token = a.createAccessToken(USER);
    const b = freshService({ JWT_ISSUER: 'somebody-else' });
    expect(b.verifyAccessToken(token)).toBeNull();
  });

  it('returns null when the audience does not match', () => {
    const a = freshService({ JWT_AUDIENCE: 'projtrack-web' });
    const token = a.createAccessToken(USER);
    const b = freshService({ JWT_AUDIENCE: 'projtrack-mobile' });
    expect(b.verifyAccessToken(token)).toBeNull();
  });

  it('returns null for an expired token', () => {
    const svc = freshService({ JWT_ACCESS_TTL_MS: '1' });
    const token = svc.createAccessToken(USER);
    // Wait 50 ms so the exp claim is well in the past (decode floors to seconds).
    return new Promise<void>((done) => {
      setTimeout(() => {
        expect(svc.verifyAccessToken(token)).toBeNull();
        done();
      }, 1100);
    });
  }, 5000);

  it('returns null for a token with malformed structure', () => {
    const svc = freshService();
    expect(svc.verifyAccessToken('not.a.real.jwt.string')).toBeNull();
    expect(svc.verifyAccessToken('only-one-segment')).toBeNull();
    expect(svc.verifyAccessToken('')).toBeNull();
  });
});
