require('reflect-metadata');

const path = require('path');
const { config } = require('dotenv');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { PrismaClient } = require('@prisma/client');

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isSuccess(status) {
  return status === 200 || status === 201;
}

function isEnabled(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function resolveSmokeIdentifier(prefix) {
  return process.env[`${prefix}_IDENTIFIER`] || process.env[`${prefix}_EMAIL`] || '';
}

async function main() {
  const backendDir = path.resolve(__dirname, '..');
  config({ path: path.join(backendDir, '.env') });
  const argSet = new Set(process.argv.slice(2));

  const { AppModule } = require(path.join(backendDir, 'dist', 'app.module'));
  const app = await NestFactory.create(AppModule, {
    logger: isEnabled(process.env.SMOKE_DEBUG_ERRORS, false) ? ['error', 'warn'] : false,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.enableCors({ origin: true });
  await app.listen(0);

  const prisma = new PrismaClient();
  const baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  const expectReady = String(process.env.SMOKE_EXPECT_READY || 'false').toLowerCase() === 'true';
  const useRealAccounts = argSet.has('--real-accounts')
    ? true
    : argSet.has('--local-accounts')
      ? false
      : isEnabled(process.env.SMOKE_USE_REAL_ACCOUNTS, false);
  const configuredRoleAccounts = [
    {
      role: 'ADMIN',
      identifier: resolveSmokeIdentifier('SMOKE_ADMIN'),
      password: process.env.SMOKE_ADMIN_PASSWORD || '',
      profilePath: '/admin/profile',
    },
    {
      role: 'TEACHER',
      identifier: resolveSmokeIdentifier('SMOKE_TEACHER'),
      password: process.env.SMOKE_TEACHER_PASSWORD || '',
      profilePath: '/teacher/profile',
    },
    {
      role: 'STUDENT',
      identifier: resolveSmokeIdentifier('SMOKE_STUDENT'),
      password: process.env.SMOKE_STUDENT_PASSWORD || '',
      profilePath: '/student/profile',
    },
  ];

  const roleAccounts = useRealAccounts
    ? configuredRoleAccounts.filter(
        (account) =>
          account.role === 'ADMIN' ||
          (String(account.identifier).trim() && String(account.password).trim()),
      )
    : configuredRoleAccounts;

  const missingCredentialRoles = roleAccounts
    .filter((account) => !String(account.identifier).trim() || !String(account.password).trim())
    .map((account) => account.role);

  if (missingCredentialRoles.length > 0) {
    throw new Error(
      `Missing smoke credentials for role(s): ${missingCredentialRoles.join(', ')}. ` +
        (useRealAccounts
          ? 'Set SMOKE_ADMIN_* environment variables. Optional SMOKE_TEACHER_* and SMOKE_STUDENT_* variables are verified when present. '
          : 'Set SMOKE_ADMIN_*, SMOKE_TEACHER_*, and SMOKE_STUDENT_* environment variables. ') +
        'Use either *_IDENTIFIER or *_EMAIL together with *_PASSWORD.',
    );
  }

  const request = async (relativeUrl, init = {}) => {
    const response = await fetch(`${baseUrl}${relativeUrl}`, {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    let setCookie = [];
    if (typeof response.headers.getSetCookie === 'function') {
      setCookie = response.headers.getSetCookie();
    } else {
      const raw = response.headers.get('set-cookie');
      if (raw) setCookie = [raw];
    }
    return { status: response.status, body, setCookie };
  };

  const REFRESH_COOKIE_NAME = '__Secure-projtrack_refresh';
  const extractRefreshToken = (response) => {
    if (response && response.body && typeof response.body === 'object' && response.body.refreshToken) {
      return response.body.refreshToken;
    }
    const cookies = (response && response.setCookie) || [];
    for (const cookie of cookies) {
      const match = cookie.match(new RegExp(`(?:^|;\\s*)${REFRESH_COOKIE_NAME}=([^;]+)`));
      if (match) return decodeURIComponent(match[1]);
    }
    return '';
  };

  let adminAccessToken = '';
  let originalAdminProfile = null;
  let throttleKey = '';
  let uploadedSmokeFile = null;
  let uploadedAdminAvatar = null;
  const skippedChecks = [];

  try {
    console.log(
      JSON.stringify(
        {
          smokeMode: useRealAccounts ? 'real-accounts' : 'local-mutation-safe',
          verifiedRoles: roleAccounts.map((account) => account.role),
        },
        null,
        2,
      ),
    );

    const liveHealth = await request('/health/live');
    expect(liveHealth.status === 200, `Unexpected /health/live status: ${liveHealth.status}`);
    expect(liveHealth.body?.ok === true, `Liveness check failed: ${JSON.stringify(liveHealth.body)}`);

    const publicDatabaseHealth = await request('/health/database');
    expect(
      publicDatabaseHealth.status === 401,
      `Expected public /health/database to require admin auth, got ${publicDatabaseHealth.status}`,
    );

    const readyHealth = await request('/health/ready');
    expect(readyHealth.status === 200, `Unexpected /health/ready status: ${readyHealth.status}`);
    expect(readyHealth.body?.checks?.database === true, `Readiness database check failed: ${JSON.stringify(readyHealth.body)}`);
    if (expectReady) {
      expect(readyHealth.body?.ok === true, `Expected /health/ready to pass: ${JSON.stringify(readyHealth.body)}`);
    }

    for (const account of roleAccounts) {
      const login = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: account.identifier,
          password: account.password,
          expectedRole: account.role,
        }),
      });
      expect(isSuccess(login.status), `${account.role} login failed: ${JSON.stringify(login.body)}`);
      expect(Boolean(login.body?.accessToken), `${account.role} login did not return an access token.`);
      expect(
        Boolean(extractRefreshToken(login)),
        `${account.role} login did not return a refresh token (checked body and ${REFRESH_COOKIE_NAME} cookie).`,
      );

      if (account.role === 'ADMIN') {
        adminAccessToken = login.body.accessToken;
      }
    }

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: roleAccounts[0].identifier,
        password: roleAccounts[0].password,
        expectedRole: roleAccounts[0].role,
      }),
    });
    expect(isSuccess(adminLogin.status), `Admin verification login failed: ${JSON.stringify(adminLogin.body)}`);

    adminAccessToken = adminLogin.body.accessToken;
    const adminRefreshToken = extractRefreshToken(adminLogin);
    expect(
      Boolean(adminRefreshToken),
      `Admin verification login did not return a refresh token (checked body and ${REFRESH_COOKIE_NAME} cookie).`,
    );

    const databaseHealth = await request('/health/database', {
      method: 'GET',
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(databaseHealth.status === 200, `Unexpected authed /health/database status: ${databaseHealth.status}`);
    expect(databaseHealth.body?.ok === true, `Database health failed: ${JSON.stringify(databaseHealth.body)}`);

    const me = await request('/auth/me', {
      method: 'GET',
      headers: { authorization: `Bearer ${adminAccessToken}` },
    });
    expect(me.status === 200, `/auth/me failed: ${JSON.stringify(me.body)}`);

    const refresh = await request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    expect(isSuccess(refresh.status), `Refresh failed: ${JSON.stringify(refresh.body)}`);
    expect(Boolean(refresh.body?.accessToken), 'Refresh did not return an access token.');
    const rotatedRefreshToken = extractRefreshToken(refresh);
    expect(
      Boolean(rotatedRefreshToken),
      `Refresh did not return a refresh token (checked body and ${REFRESH_COOKIE_NAME} cookie).`,
    );

    const logout = await request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: rotatedRefreshToken }),
    });
    expect(isSuccess(logout.status), `Logout failed: ${JSON.stringify(logout.body)}`);

    const refreshAfterLogout = await request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: rotatedRefreshToken }),
    });
    expect(refreshAfterLogout.status === 401, `Refresh token should be revoked after logout: ${JSON.stringify(refreshAfterLogout.body)}`);

    const throttleIdentifier = `throttle-${Date.now()}@projtrack.local`;
    throttleKey = `login|admin:${throttleIdentifier}|::ffff:127.0.0.1`;
    await prisma.authRateLimit.deleteMany({ where: { action: 'login', key: throttleKey } });

    const throttleStatuses = [];
    for (let i = 0; i < 6; i += 1) {
      const attempt = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: throttleIdentifier,
          password: 'WrongPassword123!',
          expectedRole: 'ADMIN',
        }),
      });
      throttleStatuses.push(attempt.status);
    }
    expect(
      throttleStatuses.slice(0, 5).every((status) => status === 401) && throttleStatuses[5] === 429,
      `Unexpected login throttle progression: ${JSON.stringify(throttleStatuses)}`,
    );

    if (useRealAccounts) {
      skippedChecks.push(
        'forgot-password flow',
        'admin profile mutation',
        'admin avatar upload',
        'object storage upload/delete roundtrip',
      );
    } else {
      const forgotPassword = await request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: roleAccounts[2].identifier }),
      });
      expect(
        isSuccess(forgotPassword.status),
        `Forgot-password request failed: ${JSON.stringify(forgotPassword.body)}`,
      );
      const studentAfterResetRequest = await prisma.user.findUnique({
        where: { email: roleAccounts[2].identifier.toLowerCase() },
      });
      expect(Boolean(studentAfterResetRequest?.id), 'Smoke student was not found after forgot-password.');
      const resetTokenSession = await prisma.accountActionToken.findFirst({
        where: {
          userId: studentAfterResetRequest.id,
          type: 'PASSWORD_RESET',
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(Boolean(resetTokenSession), 'Forgot-password did not persist an active password-reset token session.');
      expect(Boolean(resetTokenSession.publicRef), 'Password-reset token session did not include a public ref.');
      expect(
        /^[a-f0-9]{64}$/i.test(String(resetTokenSession.tokenHash || '')),
        `Reset token should be stored as a SHA-256 hash: ${resetTokenSession.tokenHash}`,
      );
      expect(Boolean(resetTokenSession.encryptedToken), 'Password-reset token session did not store the encrypted link token.');
      const latestResetJob = await prisma.emailJob.findFirst({
        where: { userEmail: roleAccounts[2].identifier.toLowerCase() },
        orderBy: { createdAt: 'desc' },
      });
      expect(latestResetJob?.templateKey === 'password-reset', 'Forgot-password queued the wrong mail template.');

      const adminProfile = await request(roleAccounts[0].profilePath, {
        method: 'GET',
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(adminProfile.status === 200, `Admin profile load failed: ${JSON.stringify(adminProfile.body)}`);
      originalAdminProfile = adminProfile.body?.form;
      expect(Boolean(originalAdminProfile), 'Admin profile form was missing from the response.');

      const updatedPhone = `+63-917-555-${String(Date.now()).slice(-4)}`;
      const updatedOffice = `Ops Room ${String(Date.now()).slice(-3)}`;
      const avatarUpload = await request('/files/upload-base64', {
        method: 'POST',
        headers: { authorization: `Bearer ${adminAccessToken}` },
        body: JSON.stringify({
          fileName: 'admin-smoke.png',
          contentBase64:
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX0XW0AAAAASUVORK5CYII=',
          scope: 'admin-profile-avatars',
        }),
      });
      expect(
        avatarUpload.status === 201 || avatarUpload.status === 200,
        `Admin avatar upload failed: ${JSON.stringify(avatarUpload.body)}`,
      );
      expect(Boolean(avatarUpload.body?.relativePath), 'Admin avatar upload did not return a relativePath.');
      uploadedAdminAvatar = avatarUpload.body;
      const updatedAvatarRelativePath = avatarUpload.body.relativePath;

      const updateProfile = await request(roleAccounts[0].profilePath, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${adminAccessToken}` },
        body: JSON.stringify({
          ...originalAdminProfile,
          phone: updatedPhone,
          office: updatedOffice,
          avatarRelativePath: updatedAvatarRelativePath,
        }),
      });
      expect(updateProfile.status === 200, `Admin profile update failed: ${JSON.stringify(updateProfile.body)}`);

      const reloadedProfile = await request(roleAccounts[0].profilePath, {
        method: 'GET',
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(reloadedProfile.status === 200, `Admin profile reload failed: ${JSON.stringify(reloadedProfile.body)}`);
      expect(reloadedProfile.body?.form?.phone === updatedPhone, 'Admin phone was not persisted.');
      expect(reloadedProfile.body?.form?.office === updatedOffice, 'Admin office was not persisted.');
      expect(
        reloadedProfile.body?.form?.avatarRelativePath === updatedAvatarRelativePath,
        'Admin avatarRelativePath was not persisted.',
      );

      const upload = await request('/files/upload-base64', {
        method: 'POST',
        headers: { authorization: `Bearer ${adminAccessToken}` },
        body: JSON.stringify({
          fileName: 'smoke-check.txt',
          contentBase64: Buffer.from('projtrack smoke file', 'utf8').toString('base64'),
          scope: 'smoke-files',
        }),
      });
      expect(upload.status === 201 || upload.status === 200, `File upload failed: ${JSON.stringify(upload.body)}`);
      expect(Boolean(upload.body?.relativePath), 'File upload did not return a relativePath.');
      uploadedSmokeFile = upload.body;

      const fileMeta = await request(`/files/meta/smoke-files/${encodeURIComponent(upload.body.storedName)}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(fileMeta.status === 200, `File meta lookup failed: ${JSON.stringify(fileMeta.body)}`);

      const fileDownload = await fetch(`${baseUrl}/files/download/smoke-files/${encodeURIComponent(upload.body.storedName)}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${adminAccessToken}` },
        redirect: 'manual',
      });
      expect(fileDownload.status === 200 || fileDownload.status === 302, `File download failed with status ${fileDownload.status}.`);

      const fileDelete = await request(`/files/smoke-files/${encodeURIComponent(upload.body.storedName)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(fileDelete.status === 200, `File delete failed: ${JSON.stringify(fileDelete.body)}`);
      uploadedSmokeFile = null;
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          smokeMode: useRealAccounts ? 'real-accounts' : 'local-mutation-safe',
          database: databaseHealth.body,
          live: liveHealth.body,
          ready: readyHealth.body,
          throttleStatuses,
          verifiedRoles: roleAccounts.map((account) => account.role),
          skippedChecks,
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      if (originalAdminProfile && adminAccessToken) {
        await request(roleAccounts[0].profilePath, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${adminAccessToken}` },
          body: JSON.stringify(originalAdminProfile),
        });
      }
      if (throttleKey) {
        await prisma.authRateLimit.deleteMany({ where: { action: 'login', key: throttleKey } });
      }
      if (uploadedSmokeFile && adminAccessToken) {
        await request(`/files/${encodeURIComponent(uploadedSmokeFile.scope)}/${encodeURIComponent(uploadedSmokeFile.storedName)}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${adminAccessToken}` },
        });
      }
      if (uploadedAdminAvatar && adminAccessToken) {
        await request(
          `/files/${encodeURIComponent(uploadedAdminAvatar.scope)}/${encodeURIComponent(uploadedAdminAvatar.storedName)}`,
          {
            method: 'DELETE',
            headers: { authorization: `Bearer ${adminAccessToken}` },
          },
        );
      }
    } finally {
      await prisma.$disconnect();
      await app.close();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
