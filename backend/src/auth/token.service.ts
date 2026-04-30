
import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class TokenService {
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET;
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET;
  private readonly accessTtlMs = Number(process.env.JWT_ACCESS_TTL_MS || 15 * 60 * 1000);
  private readonly refreshTtlMs = Number(process.env.JWT_REFRESH_TTL_MS || 7 * 24 * 60 * 60 * 1000);
  private readonly issuer = String(process.env.JWT_ISSUER || 'projtrack-api').trim();
  private readonly audience = String(process.env.JWT_AUDIENCE || 'projtrack-web').trim();
  private readonly keyId = String(process.env.JWT_KEY_ID || 'primary').trim();
  private readonly algorithm = 'HS256';

  constructor() {
    if (!this.accessSecret || !this.refreshSecret) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required.');
    }
  }

  private encode(payload: Record<string, unknown>, secret: string) {
    const header = Buffer.from(JSON.stringify({
      alg: this.algorithm,
      typ: 'JWT',
      kid: this.keyId,
    })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signed = `${header}.${body}`;
    const sig = createHmac('sha256', secret).update(signed).digest('base64url');
    return `${signed}.${sig}`;
  }

  private decode(token: string, secret: string, expectedType: 'access' | 'refresh') {
    const [headerRaw, body, sig] = token.split('.');
    if (!headerRaw || !body || !sig) return null;
    const expected = createHmac('sha256', secret).update(`${headerRaw}.${body}`).digest('base64url');
    const expectedBytes = Buffer.from(expected);
    const actualBytes = Buffer.from(sig);
    if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) return null;
    try {
      const header = JSON.parse(Buffer.from(headerRaw, 'base64url').toString('utf8'));
      if (header?.alg !== this.algorithm || header?.typ !== 'JWT') return null;
      if (this.keyId && header?.kid !== this.keyId) return null;
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (payload?.type !== expectedType) return null;
      if (payload?.iss !== this.issuer || payload?.aud !== this.audience) return null;
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (typeof payload?.iat !== 'number' || typeof payload?.exp !== 'number') return null;
      if (payload.iat > nowSeconds + 60) return null;
      if (payload.exp <= nowSeconds) return null;
      return payload;
    } catch {
      return null;
    }
  }

  getAccessTtlMs() {
    return this.accessTtlMs;
  }

  getRefreshTtlMs() {
    return this.refreshTtlMs;
  }

  createAccessToken(user: { id: string; role: string; email: string }) {
    const issuedAt = Math.floor(Date.now() / 1000);
    return this.encode(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
        type: 'access',
        iss: this.issuer,
        aud: this.audience,
        iat: issuedAt,
        exp: issuedAt + Math.floor(this.accessTtlMs / 1000),
      },
      this.accessSecret,
    );
  }

  createRefreshToken(user: { id: string; role: string; email: string }, sessionId: string) {
    const issuedAt = Math.floor(Date.now() / 1000);
    return this.encode(
      {
        sub: user.id,
        role: user.role,
        email: user.email,
        type: 'refresh',
        sid: sessionId,
        iss: this.issuer,
        aud: this.audience,
        iat: issuedAt,
        exp: issuedAt + Math.floor(this.refreshTtlMs / 1000),
      },
      this.refreshSecret,
    );
  }

  verifyAccessToken(token: string) {
    return this.decode(token, this.accessSecret, 'access');
  }

  verifyRefreshToken(token: string) {
    return this.decode(token, this.refreshSecret, 'refresh');
  }
}
