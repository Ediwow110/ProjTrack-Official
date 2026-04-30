require('reflect-metadata');

const path = require('path');
const { config } = require('dotenv');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { PrismaClient } = require('@prisma/client');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const backendDir = path.resolve(__dirname, '..');
  config({ path: path.join(backendDir, '.env') });

  const { AppModule } = require(path.join(backendDir, 'dist', 'app.module'));
  const { decryptAccountActionToken } = require(path.join(backendDir, 'dist', 'auth', 'token-crypto'));

  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({ origin: true });
  await app.listen(0);

  const prisma = new PrismaClient();
  const baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}`;
  const now = Date.now();
  const createdEmails = [`setup.${now}@projtrack.local`, `import.${now + 1}@projtrack.local`];
  const createdUserIds = [];
  let adminAccessToken = '';
  let originalAdminProfile = null;
  let uploadedAdminAvatar = null;

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
    return { status: response.status, body };
  };

  try {
    const adminIdentifier = process.env.SMOKE_ADMIN_IDENTIFIER || '';
    const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || '';
    expect(
      String(adminIdentifier).trim().length > 0 && String(adminPassword).trim().length > 0,
      'Missing SMOKE_ADMIN_IDENTIFIER or SMOKE_ADMIN_PASSWORD for onboarding-avatar smoke.',
    );

    const login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: adminIdentifier,
        password: adminPassword,
        expectedRole: 'ADMIN',
      }),
    });
    expect(login.status === 200 || login.status === 201, `Admin login failed: ${JSON.stringify(login.body)}`);
    adminAccessToken = login.body.accessToken;
    expect(Boolean(adminAccessToken), 'Admin login did not return an access token.');

    const authHeader = { authorization: `Bearer ${adminAccessToken}` };

    const sections = await request('/admin/sections', { headers: authHeader });
    expect(sections.status === 200, `Admin sections failed: ${JSON.stringify(sections.body)}`);
    const sectionName = Array.isArray(sections.body) && sections.body[0]?.code ? sections.body[0].code : '';

    const createStudent = await request('/admin/students', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        firstName: 'Setup',
        lastName: 'Student',
        email: createdEmails[0],
        studentNumber: `STU-${now}`,
        section: sectionName,
        course: 'BSIT',
        yearLevel: 3,
      }),
    });
    expect(
      createStudent.status === 200 || createStudent.status === 201,
      `Create student failed: ${JSON.stringify(createStudent.body)}`,
    );

    const createdStudent = await prisma.user.findUnique({
      where: { email: createdEmails[0] },
      include: { studentProfile: true },
    });
    expect(Boolean(createdStudent?.id), 'Created student record was not found.');
    createdUserIds.push(createdStudent.id);
    expect(
      createdStudent.status === 'PENDING_SETUP',
      `Created student status mismatch: ${createdStudent.status}`,
    );

    const createEmailJobs = await prisma.emailJob.count({ where: { userEmail: createdEmails[0] } });
    expect(
      createEmailJobs === 0,
      `Created student should not auto-send email, found ${createEmailJobs} queued job(s).`,
    );

    const forgotPending = await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: createdEmails[0] }),
    });
    expect(
      forgotPending.status === 200 || forgotPending.status === 201,
      `Forgot password for pending user failed: ${JSON.stringify(forgotPending.body)}`,
    );
    expect(
      forgotPending.body?.message === 'If this email exists, we sent instructions.',
      `Generic forgot-password message mismatch: ${JSON.stringify(forgotPending.body)}`,
    );

    const pendingResetToken = await prisma.accountActionToken.findFirst({
      where: {
        userId: createdStudent.id,
        type: 'PASSWORD_RESET',
        usedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(Boolean(pendingResetToken?.publicRef), 'Pending setup forgot-password did not create a reset token.');

    const pendingEmailJob = await prisma.emailJob.findFirst({
      where: { userEmail: createdEmails[0] },
      orderBy: { createdAt: 'desc' },
    });
    expect(
      pendingEmailJob?.templateKey === 'password-reset',
      `Pending setup email template mismatch: ${pendingEmailJob?.templateKey}`,
    );
    expect(
      pendingEmailJob?.payload?.isFirstTimeSetup === true,
      'Pending setup email should mark isFirstTimeSetup=true.',
    );

    const resetPending = await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        ref: pendingResetToken.publicRef,
        token: decryptAccountActionToken(pendingResetToken.encryptedToken),
        password: 'SetupPass123!',
        confirmPassword: 'SetupPass123!',
      }),
    });
    expect(
      resetPending.status === 200 || resetPending.status === 201,
      `Reset password for pending user failed: ${JSON.stringify(resetPending.body)}`,
    );

    const activatedStudent = await prisma.user.findUnique({ where: { id: createdStudent.id } });
    expect(
      activatedStudent?.status === 'ACTIVE',
      `Pending setup user should become ACTIVE after password setup, got ${activatedStudent?.status}`,
    );

    const forgotActive = await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: createdEmails[0] }),
    });
    expect(
      forgotActive.status === 200 || forgotActive.status === 201,
      `Forgot password for active user failed: ${JSON.stringify(forgotActive.body)}`,
    );
    const activeEmailJob = await prisma.emailJob.findFirst({
      where: { userEmail: createdEmails[0] },
      orderBy: { createdAt: 'desc' },
    });
    expect(
      activeEmailJob?.payload?.isFirstTimeSetup === false,
      'Active user forgot-password should send a normal reset email.',
    );

    const previewImport = await request('/admin/students/import', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        fileName: 'students.csv',
        fileType: 'csv',
        csvText: [
          'student_id,first_name,last_name,email,course,year_level,section,academic_year',
          `STU-${now + 1},Import,Student,${createdEmails[1]},BSIT,3,${sectionName || 'BSIT 3A'},2025-2026`,
          'BROKEN-ROW,Missing,Section,broken-import@projtrack.local,BSIT,3,,2025-2026',
        ].join('\n'),
      }),
    });
    expect(
      previewImport.status === 200 || previewImport.status === 201,
      `Import preview failed: ${JSON.stringify(previewImport.body)}`,
    );
    expect(previewImport.body?.validRows === 1, `Import preview validRows mismatch: ${JSON.stringify(previewImport.body)}`);
    expect(previewImport.body?.invalidRows === 1, `Import preview invalidRows mismatch: ${JSON.stringify(previewImport.body)}`);

    const acceptedRowIndexes = (previewImport.body.preview || [])
      .filter((row) => row.valid)
      .map((row) => row.index);

    const confirmImport = await request('/admin/students/import/confirm', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        batchId: previewImport.body.batchId,
        acceptedRowIndexes,
      }),
    });
    expect(
      confirmImport.status === 200 || confirmImport.status === 201,
      `Import confirm failed: ${JSON.stringify(confirmImport.body)}`,
    );
    expect(confirmImport.body?.summary?.created === 1, `Import summary created mismatch: ${JSON.stringify(confirmImport.body)}`);
    expect(confirmImport.body?.summary?.updatedOrSkipped === 0, `Import summary updated/skipped mismatch: ${JSON.stringify(confirmImport.body)}`);
    expect(confirmImport.body?.summary?.invalidRows === 1, `Import summary invalidRows mismatch: ${JSON.stringify(confirmImport.body)}`);
    expect(confirmImport.body?.summary?.pendingSetup === 1, `Import summary pendingSetup mismatch: ${JSON.stringify(confirmImport.body)}`);

    const importedStudent = await prisma.user.findUnique({
      where: { email: createdEmails[1] },
      include: { studentProfile: true },
    });
    expect(Boolean(importedStudent?.id), 'Imported student record was not found.');
    createdUserIds.push(importedStudent.id);
    expect(
      importedStudent.status === 'PENDING_SETUP',
      `Imported student status mismatch: ${importedStudent.status}`,
    );

    const importedCreateEmailJobs = await prisma.emailJob.count({ where: { userEmail: createdEmails[1] } });
    expect(
      importedCreateEmailJobs === 0,
      `Imported student should not auto-send email, found ${importedCreateEmailJobs} queued job(s).`,
    );

    const forgotImported = await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: createdEmails[1] }),
    });
    expect(
      forgotImported.status === 200 || forgotImported.status === 201,
      `Forgot password for imported user failed: ${JSON.stringify(forgotImported.body)}`,
    );
    const importedEmailJob = await prisma.emailJob.findFirst({
      where: { userEmail: createdEmails[1] },
      orderBy: { createdAt: 'desc' },
    });
    expect(
      importedEmailJob?.payload?.isFirstTimeSetup === true,
      'Imported pending user should receive first-time setup email.',
    );

    const manualPendingLink = await request(`/admin/students/${importedStudent.id}/send-reset-link`, {
      method: 'POST',
      headers: authHeader,
    });
    expect(
      manualPendingLink.status === 200 || manualPendingLink.status === 201,
      `Manual setup link for pending user failed: ${JSON.stringify(manualPendingLink.body)}`,
    );
    expect(
      manualPendingLink.body?.firstTimeSetup === true,
      `Pending manual setup link should be first-time setup: ${JSON.stringify(manualPendingLink.body)}`,
    );

    const manualActiveLink = await request(`/admin/students/${createdStudent.id}/send-reset-link`, {
      method: 'POST',
      headers: authHeader,
    });
    expect(
      manualActiveLink.status === 200 || manualActiveLink.status === 201,
      `Manual reset link for active user failed: ${JSON.stringify(manualActiveLink.body)}`,
    );
    expect(
      manualActiveLink.body?.firstTimeSetup === false,
      `Active manual reset link should be standard reset: ${JSON.stringify(manualActiveLink.body)}`,
    );

    const forgotUnknown = await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: `ghost.${now}@projtrack.local` }),
    });
    expect(
      forgotUnknown.body?.message === 'If this email exists, we sent instructions.',
      'Forgot-password should stay generic for unknown emails.',
    );

    const adminProfile = await request('/admin/profile', {
      method: 'GET',
      headers: authHeader,
    });
    expect(adminProfile.status === 200, `Admin profile read failed: ${JSON.stringify(adminProfile.body)}`);
    originalAdminProfile = adminProfile.body?.form;

    const avatarUpload = await request('/files/upload-base64', {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        fileName: 'avatar-smoke.png',
        contentBase64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX0XW0AAAAASUVORK5CYII=',
        scope: 'admin-profile-avatars',
      }),
    });
    expect(
      avatarUpload.status === 200 || avatarUpload.status === 201,
      `Avatar upload failed: ${JSON.stringify(avatarUpload.body)}`,
    );
    uploadedAdminAvatar = avatarUpload.body;

    const updateAdminProfile = await request('/admin/profile', {
      method: 'PATCH',
      headers: authHeader,
      body: JSON.stringify({
        ...originalAdminProfile,
        avatarRelativePath: uploadedAdminAvatar.relativePath,
      }),
    });
    expect(
      updateAdminProfile.status === 200,
      `Admin profile update failed: ${JSON.stringify(updateAdminProfile.body)}`,
    );

    const meWithAvatar = await request('/auth/me', {
      method: 'GET',
      headers: authHeader,
    });
    expect(meWithAvatar.status === 200, `Auth me with avatar failed: ${JSON.stringify(meWithAvatar.body)}`);
    expect(
      meWithAvatar.body?.avatarRelativePath === uploadedAdminAvatar.relativePath,
      'Auth me should surface the uploaded avatar path.',
    );

    const deleteAvatar = await request(
      `/files/${encodeURIComponent(uploadedAdminAvatar.scope)}/${encodeURIComponent(uploadedAdminAvatar.storedName)}`,
      {
        method: 'DELETE',
        headers: authHeader,
      },
    );
    expect(
      deleteAvatar.status === 200,
      `Avatar cleanup delete failed: ${JSON.stringify(deleteAvatar.body)}`,
    );
    uploadedAdminAvatar = null;

    const meAfterMissingAvatar = await request('/auth/me', {
      method: 'GET',
      headers: authHeader,
    });
    expect(
      meAfterMissingAvatar.status === 200,
      `Auth me after avatar deletion failed: ${JSON.stringify(meAfterMissingAvatar.body)}`,
    );
    expect(
      meAfterMissingAvatar.body?.avatarRelativePath === '',
      'Auth me should sanitize stale avatar paths to an empty string.',
    );

    const profileAfterMissingAvatar = await request('/admin/profile', {
      method: 'GET',
      headers: authHeader,
    });
    expect(
      profileAfterMissingAvatar.status === 200,
      `Admin profile after avatar deletion failed: ${JSON.stringify(profileAfterMissingAvatar.body)}`,
    );
    expect(
      profileAfterMissingAvatar.body?.form?.avatarRelativePath === '',
      'Admin profile should sanitize stale avatar paths to an empty string.',
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          verified: {
            manualCreatePendingSetup: true,
            noAutoEmailOnCreate: true,
            forgotPasswordPendingSetup: true,
            passwordSetupActivatesUser: true,
            forgotPasswordActiveReset: true,
            importPendingSetup: true,
            importSummary: confirmImport.body.summary,
            manualSetupLinkPending: true,
            manualResetLinkActive: true,
            genericForgotPasswordForUnknownEmail: true,
            avatarCurrentUserSanitizesMissingFiles: true,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    try {
      if (originalAdminProfile && adminAccessToken) {
        await request('/admin/profile', {
          method: 'PATCH',
          headers: { authorization: `Bearer ${adminAccessToken}` },
          body: JSON.stringify(originalAdminProfile),
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
      for (const email of createdEmails) {
        await prisma.emailJob.deleteMany({ where: { userEmail: email } });
      }
      for (const userId of createdUserIds) {
        await prisma.notification.deleteMany({ where: { userId } });
        await prisma.auditLog.deleteMany({ where: { actorUserId: userId } });
        await prisma.authSession.deleteMany({ where: { userId } });
        await prisma.accountActionToken.deleteMany({ where: { userId } });
        await prisma.studentProfile.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
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
