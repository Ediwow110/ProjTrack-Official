import { BadRequestException } from '@nestjs/common';
import { FilesController } from '../../src/files/files.controller';
import { FilesService } from '../../src/files/files.service';

function buildFilesService() {
  const prisma = {
    pendingUpload: { create: jest.fn() },
    submissionFile: { findMany: jest.fn(async () => []) },
  } as any;
  const access = {
    requireUserCanDownloadFile: jest.fn(),
    requireUserCanDeleteFile: jest.fn(),
  } as any;
  const auditLogs = { record: jest.fn(async () => undefined) } as any;
  return { service: new FilesService(prisma, access, auditLogs), prisma, access, auditLogs };
}

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe('file access abuse security gate', () => {
  it('uses authenticated token identity for multipart uploads instead of trusting client body ownership', async () => {
    const files = { uploadBuffer: jest.fn(async (input) => input) } as any;
    const controller = new FilesController(files);

    await controller.uploadMultipart(
      { originalname: 'report.txt', mimetype: 'text/plain', buffer: Buffer.from('safe text') },
      { scope: 'submissions', uploadedByUserId: 'attacker-controlled' } as any,
      { user: { sub: 'token-user-1', role: 'STUDENT' } },
    );

    expect(files.uploadBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedByUserId: 'token-user-1',
        uploadedByRole: 'STUDENT',
      }),
    );
    expect(files.uploadBuffer.mock.calls[0][0]).not.toMatchObject({ uploadedByUserId: 'attacker-controlled' });
  });

  it('uses authenticated token identity for base64 uploads instead of trusting client body ownership', async () => {
    const files = { uploadBase64: jest.fn(async (input) => input) } as any;
    const controller = new FilesController(files);

    await controller.uploadBase64(
      { fileName: 'report.txt', contentBase64: Buffer.from('safe').toString('base64'), scope: 'submissions', uploadedByUserId: 'body-user' } as any,
      { user: { sub: 'token-user-2', role: 'TEACHER' } },
    );

    expect(files.uploadBase64).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedByUserId: 'token-user-2',
        uploadedByRole: 'TEACHER',
      }),
    );
  });

  it('passes actor identity into metadata/download/delete service calls', async () => {
    const files = {
      resolveForDownload: jest.fn(async () => ({ absolutePath: '/tmp/report.txt', fileName: 'report.txt' })),
      remove: jest.fn(async () => ({ success: true })),
    } as any;
    const controller = new FilesController(files);
    const actorReq = { user: { sub: 'teacher-1', role: 'TEACHER' } };
    const res = { download: jest.fn(), redirect: jest.fn() } as any;

    await controller.meta('submissions', 'file.txt', actorReq);
    await controller.download('submissions', 'file.txt', actorReq, res);
    await controller.remove('submissions', 'file.txt', actorReq);

    expect(files.resolveForDownload).toHaveBeenCalledWith('submissions/file.txt', { userId: 'teacher-1', role: 'TEACHER' });
    expect(files.remove).toHaveBeenCalledWith('submissions/file.txt', { userId: 'teacher-1', role: 'TEACHER' });
  });

  it('rejects executable/script upload extensions before storage write', async () => {
    const { service, prisma } = buildFilesService();

    await expect(
      service.uploadBuffer({
        fileName: 'payload.exe',
        contentType: 'application/octet-stream',
        buffer: Buffer.from('MZ executable'),
        scope: 'submissions',
        uploadedByUserId: 'student-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.pendingUpload.create).not.toHaveBeenCalled();
  });

  it('rejects MIME types that do not match the extension', async () => {
    const { service } = buildFilesService();

    await expect(
      service.uploadBuffer({
        fileName: 'report.pdf',
        contentType: 'text/plain',
        buffer: Buffer.from('%PDF fake pdf'),
        scope: 'submissions',
      }),
    ).rejects.toThrow(/MIME type/i);
  });

  it('rejects content whose magic bytes do not match the extension', async () => {
    const { service } = buildFilesService();

    await expect(
      service.uploadBuffer({
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('not actually a pdf'),
        scope: 'submissions',
      }),
    ).rejects.toThrow(/does not match/i);
  });

  it('rejects base64 JSON uploads in production unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.ALLOW_BASE64_UPLOADS_IN_PRODUCTION = 'false';
    const { service } = buildFilesService();

    await expect(
      service.uploadBase64({
        fileName: 'report.txt',
        contentBase64: Buffer.from('plain text').toString('base64'),
        scope: 'submissions',
        uploadedByUserId: 'student-1',
      }),
    ).rejects.toThrow(/disabled in production/i);
  });

  it('rejects invalid upload scopes', async () => {
    const { service } = buildFilesService();

    await expect(
      service.uploadBuffer({
        fileName: 'report.txt',
        contentType: 'text/plain',
        buffer: Buffer.from('plain text'),
        scope: '../escape',
      }),
    ).rejects.toThrow(/Invalid upload scope/i);
  });
});
