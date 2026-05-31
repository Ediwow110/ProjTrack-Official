import { TokenService } from '../src/auth/token.service';

function main() {
  // Using the fallback secret that the backend is actually using
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

  const teacherToken = tokenService.createAccessToken({
    id: 'cmpsq0q750000v7385zyjc3gh',
    role: 'TEACHER',
    email: 'teacher-test@projtrack.codes',
  });

  const studentToken = tokenService.createAccessToken({
    id: 'cmoovs1kr000d2k6vj1h6j5ld',
    role: 'STUDENT',
    email: 'edmarcipriano45@gmail.com',
  });

  console.log('ADMIN:', adminToken);
  console.log('TEACHER:', teacherToken);
  console.log('STUDENT:', studentToken);
}

main();
