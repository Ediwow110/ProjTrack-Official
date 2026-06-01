import { BadRequestException } from '@nestjs/common';
import { FilesService } from '../../src/files/files.service';
import { buildDueEmailJobWhere } from '../../src/mail/mail.worker';
import { EmailJobStatus, EmailJobType } from '../../src/prisma/prisma-compat';

/**
 * Status and lifecycle validation regression tests.
 *
 * These tests lock down status/lifecycle state-machine invariants identified in the
 * silent-bug roadmap (invalid values, terminal-state reprocessing, worker claim safety,
 * and side-effect transitions such as PENDING → EXPIRED).
 *
 * Strategy: Service-level + pure function tests using the project's existing mock
 * patterns (buildFilesService style + direct function calls). No production source
 * files were modified.
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

  const hasObjectSpy = jest.spyOn(service as any, 'hasObject').mockResolvedValue(true);
  const deleteObjectSpy = jest.spyOn(service as any, 'deleteObject').mockResolvedValue(undefined);
  const putObjectSpy = jest.spyOn(service as any, 'putObject').mockResolvedValue(undefined);

  return { service, prisma, access, auditLogs, spies: { hasObject: hasObjectSpy, deleteObject: deleteObjectSpy, putObject: putObjectSpy } };
}

describe('status lifecycle validation regressions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================
  // PendingUpload lifecycle (PENDING → EXPIRED / consumed)
  // ============================================================
  describe('PendingUpload lifecycle', () => {
    it('resolvePendingUploadsForSubmission marks expired PENDING rows as EXPIRED and rejects the request', async () => {
      const { service, prisma } = buildFilesService();

      const ownerUserId = 'student-1';
      const uploadId = 'pu-expired-1';
      const now = new Date();

      prisma.pendingUpload.findMany.mockResolvedValue([
        {
          id: uploadId,
          userId: ownerUserId,
          status: 'PENDING',
          consumedAt: null,
          expiresAt: new Date(now.getTime() - 60_000), // already expired
          storageKey: 'submissions/expired.pdf',
        },
      ]);

      await expect(
        service.resolvePendingUploadsForSubmission({
          uploadIds: [uploadId],
          userId: ownerUserId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Critical lifecycle side-effect: service must have attempted to mark it EXPIRED
      expect(prisma.pendingUpload.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: [uploadId] },
            status: 'PENDING',
          }),
          data: { status: 'EXPIRED' },
        }),
      );
    });

    it('cleanupExpiredPendingUploads only selects PENDING + unconsumed + truly expired rows and marks them EXPIRED', async () => {
      const { service, prisma } = buildFilesService();

      const now = new Date();

      prisma.pendingUpload.findMany.mockResolvedValue([
        {
          id: 'pu-1',
          userId: 'u-1',
          status: 'PENDING',
          consumedAt: null,
          expiresAt: new Date(now.getTime() - 10_000),
          storageKey: 's1',
        },
      ]);

      await service.cleanupExpiredPendingUploads(50);

      // Must only target the correct lifecycle state
      expect(prisma.pendingUpload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING',
            consumedAt: null,
            expiresAt: { lt: expect.any(Date) },
          },
        }),
      );

      expect(prisma.pendingUpload.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['pu-1'] }, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        }),
      );
    });

    it('cleanupExpiredPendingUploads does not touch already-consumed or already-EXPIRED rows', async () => {
      const { service, prisma } = buildFilesService();

      prisma.pendingUpload.findMany.mockResolvedValue([]); // no rows should be selected

      await service.cleanupExpiredPendingUploads(100);

      // The where clause must still enforce the full lifecycle guard even if DB returns nothing
      const findManyCall = prisma.pendingUpload.findMany.mock.calls[0]?.[0];
      expect(findManyCall?.where).toEqual(
        expect.objectContaining({
          status: 'PENDING',
          consumedAt: null,
          expiresAt: { lt: expect.any(Date) },
        }),
      );
    });
  });

  // ============================================================
  // EmailJob claim lifecycle (only QUEUED/FAILED are eligible)
  // ============================================================
  describe('EmailJob claim lifecycle', () => {
    it('buildDueEmailJobWhere only selects QUEUED and FAILED (never SENT, DEAD, PROCESSING, or other terminal states)', () => {
      const now = new Date('2026-06-01T12:00:00Z');

      const where = buildDueEmailJobWhere({ type: EmailJobType.TRANSACTIONAL, now });

      expect(where.status).toEqual({ in: [EmailJobStatus.QUEUED, EmailJobStatus.FAILED] });
      expect(where.archivedAt).toBeNull();

      // Explicitly assert that terminal / in-flight states are excluded
      const allowed = where.status.in;
      expect(allowed).not.toContain(EmailJobStatus.SENT);
      expect(allowed).not.toContain(EmailJobStatus.DEAD);
      expect(allowed).not.toContain(EmailJobStatus.PROCESSING);
      expect(allowed).not.toContain(EmailJobStatus.CANCELLED);
      expect(allowed).not.toContain(EmailJobStatus.PAUSED_LIMIT_REACHED);
    });

    it('buildDueEmailJobWhere excludes archived jobs regardless of status', () => {
      const now = new Date();

      const where = buildDueEmailJobWhere({ type: EmailJobType.BULK, now });

      expect(where.archivedAt).toBeNull();
    });
  });
});
