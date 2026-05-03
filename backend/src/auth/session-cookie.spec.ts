import {
  clearRefreshCookie,
  isProductionRuntime,
  refreshCookieName,
  refreshTokenFromCookie,
  setRefreshCookie,
  stripRefreshTokenInProduction,
} from './session-cookie';

function fakeRes() {
  const calls: any[] = [];
  return {
    cookie: (name: string, value: string, options: any) => calls.push({ name, value, options }),
    calls,
  } as any;
}

describe('isProductionRuntime', () => {
  it('detects production via NODE_ENV', () => {
    expect(isProductionRuntime({ NODE_ENV: 'production' } as any)).toBe(true);
  });
  it('detects production via APP_ENV', () => {
    expect(isProductionRuntime({ APP_ENV: 'production' } as any)).toBe(true);
  });
  it('returns false in development', () => {
    expect(isProductionRuntime({ NODE_ENV: 'development' } as any)).toBe(false);
  });
  it('treats APP_ENV=staging as non-production for cookie purposes', () => {
    expect(isProductionRuntime({ APP_ENV: 'staging' } as any)).toBe(false);
  });
});

describe('refreshCookieName', () => {
  it('uses the __Secure- prefix in production by default', () => {
    expect(refreshCookieName({ NODE_ENV: 'production' } as any)).toBe('__Secure-projtrack_refresh');
  });
  it('uses the unprefixed default in non-production', () => {
    expect(refreshCookieName({ NODE_ENV: 'development' } as any)).toBe('projtrack_refresh');
  });
  it('honours an explicit override regardless of environment', () => {
    expect(
      refreshCookieName({ NODE_ENV: 'production', AUTH_REFRESH_COOKIE_NAME: 'custom-name' } as any),
    ).toBe('custom-name');
  });
});

describe('setRefreshCookie', () => {
  it('sets httpOnly + secure + scoped to /auth in production', () => {
    const res = fakeRes();
    setRefreshCookie(res, 'token-value', { NODE_ENV: 'production' } as any);
    expect(res.calls[0].name).toBe('__Secure-projtrack_refresh');
    expect(res.calls[0].value).toBe('token-value');
    expect(res.calls[0].options.httpOnly).toBe(true);
    expect(res.calls[0].options.secure).toBe(true);
    expect(res.calls[0].options.path).toBe('/auth');
    expect(res.calls[0].options.sameSite).toBe('lax');
    expect(typeof res.calls[0].options.maxAge).toBe('number');
  });

  it('does not set secure in non-production by default', () => {
    const res = fakeRes();
    setRefreshCookie(res, 'token-value', { NODE_ENV: 'development' } as any);
    expect(res.calls[0].options.secure).toBe(false);
  });

  it('forces secure when SameSite=None is requested in non-production', () => {
    const res = fakeRes();
    setRefreshCookie(res, 'token-value', {
      NODE_ENV: 'development',
      AUTH_REFRESH_COOKIE_SAME_SITE: 'none',
    } as any);
    expect(res.calls[0].options.secure).toBe(true);
    expect(res.calls[0].options.sameSite).toBe('none');
  });
});

describe('clearRefreshCookie', () => {
  it('writes an empty cookie with maxAge=0 and matching attributes', () => {
    const res = fakeRes();
    clearRefreshCookie(res, { NODE_ENV: 'production' } as any);
    expect(res.calls[0].name).toBe('__Secure-projtrack_refresh');
    expect(res.calls[0].value).toBe('');
    expect(res.calls[0].options.maxAge).toBe(0);
    expect(res.calls[0].options.httpOnly).toBe(true);
    expect(res.calls[0].options.path).toBe('/auth');
  });
});

describe('refreshTokenFromCookie', () => {
  it('returns the matching cookie value', () => {
    const req = { headers: { cookie: 'foo=bar; projtrack_refresh=token-x; baz=qux' } };
    expect(refreshTokenFromCookie(req, { NODE_ENV: 'development' } as any)).toBe('token-x');
  });

  it('returns "" when the cookie is missing', () => {
    expect(refreshTokenFromCookie({ headers: { cookie: 'foo=bar' } }, { NODE_ENV: 'development' } as any))
      .toBe('');
    expect(refreshTokenFromCookie({ headers: {} }, { NODE_ENV: 'development' } as any)).toBe('');
  });

  it('uses the production cookie name when NODE_ENV=production', () => {
    const req = { headers: { cookie: '__Secure-projtrack_refresh=secret-token' } };
    expect(refreshTokenFromCookie(req, { NODE_ENV: 'production' } as any)).toBe('secret-token');
  });

  it('decodes percent-encoded cookie values', () => {
    const req = { headers: { cookie: 'projtrack_refresh=token%20with%20space' } };
    expect(refreshTokenFromCookie(req, { NODE_ENV: 'development' } as any)).toBe('token with space');
  });
});

describe('stripRefreshTokenInProduction', () => {
  it('removes the refreshToken field in production', () => {
    const result = stripRefreshTokenInProduction(
      { user: { id: 'u' }, accessToken: 'a', refreshToken: 'r' },
      { NODE_ENV: 'production' } as any,
    );
    expect((result as any).refreshToken).toBeUndefined();
    expect((result as any).accessToken).toBe('a');
  });

  it('preserves the refreshToken field in development', () => {
    const result = stripRefreshTokenInProduction(
      { user: { id: 'u' }, accessToken: 'a', refreshToken: 'r' },
      { NODE_ENV: 'development' } as any,
    );
    expect((result as any).refreshToken).toBe('r');
  });
});
