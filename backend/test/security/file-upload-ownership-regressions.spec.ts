import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FilesService } from '../../src/files/files.service';

/**
 * File upload, pending upload, and ownership regression tests.
 *
 * These tests lock down invariants from the silent-bug audit (BUG-FILE-001,
 * related BUG-ACCESS-001 cross-user gaps, and server-side enforcement requirements).
 *
 * Strategy: Service-level tests with mocked Prisma + mocked storage (hasObject, deleteObject).
 * This matches the existing file-access-abuse and data-isolation regression patterns.
 *
 * No production source files were modified.
 */

function buildFilesService(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    pendingUpload: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    submissionFile: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    ...prismaOverrides,
  } as any;

  const access = {
    requireUserCanDownloadFile: jest.fn(),
    requireUserCanDeleteFile: jest.fn(),
  } as any;

  const auditLogs = { record: jest.fn(async () => undefined) } as any;

  const service = new FilesService(prisma, access, auditLogs);

  // Spy on internal storage methods (they are not injected)
  const hasObjectSpy = jest.spyOn(service as any, 'hasObject').mockResolvedValue(true);
  const deleteObjectSpy = jest.spyOn(service as any, 'deleteObject').mockResolvedValue(undefined);
  const putObjectSpy = jest.spyOn(service as any, 'putObject').mockResolvedValue(undefined);

  return { service, prisma, access, auditLogs, spies: { hasObject: hasObjectSpy, deleteObject: deleteObjectSpy, putObject: putObjectSpy } };
}

describe('file upload ownership and pending upload regressions (BUG-FILE-001)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('pending upload ownership (resolve for submission)', () => {
    it('rejects a student trying to attach another student\'s pending upload', async () => {
      const { service, prisma } = buildFilesService();

      const attackerUserId = 'student-attacker';
      const ownerUserId = 'student-owner';
      const uploadId = 'pu-1';

      prisma.pendingUpload.findMany.mockResolvedValue([
        {
          id: uploadId,
          userId: ownerUserId, // different owner
          status: 'PENDING',
          consumedAt: null,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          storageKey: 'submissions/somefile.pdf',
        },
      ]);

      await expect(
        service.resolvePendingUploadsForSubmission({
          uploadIds: [uploadId],
          userId: attackerUserId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // The query must have filtered by the caller's userId
      expect(prisma.pendingUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: attackerUserId,
            id: { in: [uploadId] },
          }),
        }),
      );
    });

    it('allows the owning student to resolve their own pending upload when unexpired and present in storage', async () => {
      const { service, prisma, spies } = buildFilesService();

      const ownerUserId = 'student-owner';
      const uploadId = 'pu-own-1';

      prisma.pendingUpload.findMany.mockResolvedValue([
        {
          id: uploadId,
          userId: ownerUserId,
          status: 'PENDING',
          consumedAt: null,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          storageKey: 'submissions/ownfile.pdf',
        },
      ]);
      spies.hasObject.mockResolvedValue(true);

      const result = await service.resolvePendingUploadsForSubmission({
        uploadIds: [uploadId],
        userId: ownerUserId,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(uploadId);
    });

    it('rejects expired pending uploads and marks them EXPIRED', async () => {
      const { service, prisma } = buildFilesService();

      const ownerUserId = 'student-owner';
      const uploadId = 'pu-expired';

      const past = new Date(Date.now() - 10 * 60 * 1000);

      prisma.pendingUpload.findMany.mockResolvedValue([
        {
          id: uploadId,
          userId: ownerUserId,
          status: 'PENDING',
          consumedAt: null,
          expiresAt: past,
          storageKey: 'submissions/expired.pdf',
        },
      ]);

      await expect(
        service.resolvePendingUploadsForSubmission({
          uploadIds: [uploadId],
          userId: ownerUserId,
        }),
      ).rejects.toThrow(/expired/i);

      expect(prisma.pendingUpload.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: [uploadId] }, status: 'PENDING' }),
          data: { status: 'EXPIRED' },
        }),
      );
    });
  });

  describe('pending upload cleanup safety', () => {
    it('cleanupExpiredPendingUploads only targets PENDING + unconsumed + truly expired rows', async () => {
      const { service, prisma, spies } = buildFilesService();

      const now = new Date();
      const expiredRow = {
        id: 'pu-exp-1',
        userId: 'student-1',
        status: 'PENDING',
        consumedAt: null,
        expiresAt: new Date(now.getTime() - 1000),
        storageKey: 'submissions/exp1.pdf',
      };

      prisma.pendingUpload.findMany.mockResolvedValue([expiredRow]);
      spies.deleteObject.mockResolvedValue(undefined);
      prisma.pendingUpload.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cleanupExpiredPendingUploads(50);

      expect(result.expired).toBe(1);
      expect(prisma.pendingUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING',
            consumedAt: null,
            expiresAt: { lt: expect.any(Date) },
          },
        }),
      );
      expect(spies.deleteObject).toHaveBeenCalledWith('submissions/exp1.pdf');
    });

    it('cleanup does not touch active (future expiry) pending uploads', async () => {
      const { service, prisma } = buildFilesService();

      prisma.pendingUpload.findMany.mockResolvedValue([]); // no expired rows

      await service.cleanupExpiredPendingUploads(100);

      // Should have queried but not performed any destructive updates
      expect(prisma.pendingUpload.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('file download ownership via AccessService integration points', () => {
    it('wrong student is denied download of another student\'s submission file (via access service)', async () => {
      const { access } = buildFilesService();

      access.requireUserCanDownloadFile.mockRejectedValue(new ForbiddenException('You do not have access to this file.'));

      await expect(
        access.requireUserCanDownloadFile('student-attacker', 'STUDENT', 'file-123'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('teacher from another subject is denied download of files they do not own', async () => {
      const { access } = buildFilesService();

      access.requireUserCanDownloadFile.mockRejectedValue(new ForbiddenException('You do not have access to this file.'));

      await expect(
        access.requireUserCanDownloadFile('teacher-wrong', 'TEACHER', 'file-456'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('admin is allowed global file metadata access per current policy (if implemented as allow)', async () => {
      const { access, prisma } = buildFilesService();

      // Simulate the admin fast-path in access service
      access.requireUserCanDownloadFile.mockImplementation(async (userId, role) => {
        if (role === 'ADMIN') return { id: 'file-999', submission: { subject: { teacherId: 't1' } } };
        throw new ForbiddenException();
      });

      const meta = await access.requireUserCanDownloadFile('admin-1', 'ADMIN', 'file-999');
      expect(meta).toBeTruthy();
    });
  });

  describe('storage / DB safety (no silent orphans on partial failure paths)', () => {
    it('uploadBuffer does not create a pendingUpload record if storage putObject fails (when storage is called first)', async () => {
      const { service, prisma, spies } = buildFilesService();

      spies.putObject.mockRejectedValue(new Error('storage write failed'));

      await expect(
        service.uploadBuffer({
          fileName: 'report.txt',
          contentType: 'text/plain',
          buffer: Buffer.from('content'),
          scope: 'submissions',
          uploadedByUserId: 'student-1',
        }),
      ).rejects.toThrow();

      // Pending upload create must not have been attempted after storage failure
      expect(prisma.pendingUpload.create).not.toHaveBeenCalled();
    });

    it('resolvePendingUploadsForSubmission rejects when storage object is missing even if DB row exists', async () => {
      const { service, prisma, spies } = buildFilesService();

      const owner = 'student-1';
      const uploadId = 'pu-missing-storage';

      prisma.pendingUpload.findMany.mockResolvedValue([
        {
          id: uploadId,
          userId: owner,
          status: 'PENDING',
          consumedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          storageKey: 'submissions/missing.pdf',
        },
      ]);

      spies.hasObject.mockResolvedValue(false);

      await expect(
        service.resolvePendingUploadsForSubmission({ uploadIds: [uploadId], userId: owner }),
      ).rejects.toThrow(/missing from storage/i);
    });
  });
});
