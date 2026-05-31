import { TokenService } from '../src/auth/token.service';

function main() {
  // Try the fallback secret from start-dev-local.cjs
  process.env.JWT_ACCESS_SECRET = 'local-dev-access-secret-change-before-production-1234567890';
  process.env.JWT_REFRESH_SECRET = 'local-dev-refresh-secret-change-before-production-1234567890';
  process.env.JWT_ISSUER = 'projtrack-api-local';
  process.env.JWT_AUDIENCE = 'projtrack-web-local';
  process.env.JWT_KEY_ID = 'local-dev';

  const tokenService = new TokenService();
  
  const adminToken = tokenService.createAccessToken({
    id: 'cmoov6u2m0000xoy90fyilhm2',
    role: 'ADMIN',
    email: 'admin@projtrack.codes',
  });

  console.log('ADMIN_LONG_SECRET:', adminToken);
}

main();
