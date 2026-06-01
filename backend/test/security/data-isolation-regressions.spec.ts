import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AccessService } from '../../src/access/access.service';

function buildAccessService(prismaOverrides: Record<string, any> = {}) {
  const prisma = {
    user: { findUnique: jest.fn() },
    studentProfile: { findUnique: jest.fn() },
    teacherProfile: { findUnique: jest.fn() },
    subject: { findUnique: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    submission: { findUnique: jest.fn() },
    submissionFile: { findFirst: jest.fn() },
    groupMember: { findFirst: jest.fn() },
    group: { findFirst: jest.fn() },
    submissionTask: { findUnique: jest.fn() },
    ...prismaOverrides,
  } as any;

  return { service: new AccessService(prisma), prisma };
}

/**
 * Comprehensive data-isolation regression tests for student/teacher boundaries.
 *
 * These tests exist specifically to lock down the invariants from the silent-bug audit
 * (BUG-ACCESS-001 and related risks). They should continue to pass even after future
 * refactors to access control logic.
 */
describe('data-isolation regressions (student/teacher boundaries)', () => {
  describe('student cannot access another student\'s individual submission', () => {
    it('rejects a different student trying to access an individual submission', async () => {
      const { service, prisma } = buildAccessService();
      prisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        subjectId: 'subject-1',
        studentId: 'student-owner-user',
        group: null,
      });
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'student-profile-attacker', userId: 'student-attacker-user' });
      prisma.subject.findUnique.mockResolvedValue({ id: 'subject-1', isOpen: true, groupEnabled: false, maxGroupSize: 1 });
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-1', studentId: 'student-profile-attacker', subjectId: 'subject-1' });

      await expect(
        service.requireStudentCanAccessSubmission('student-attacker-user', 'submission-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows the owning student to access their own individual submission', async () => {
      const { service, prisma } = buildAccessService();
      prisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        subjectId: 'subject-1',
        studentId: 'student-owner-user',
        group: null,
      });
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'student-profile-owner', userId: 'student-owner-user' });
      prisma.subject.findUnique.mockResolvedValue({ id: 'subject-1', isOpen: true, groupEnabled: false, maxGroupSize: 1 });
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-1', studentId: 'student-profile-owner', subjectId: 'subject-1' });

      await expect(service.requireStudentCanAccessSubmission('student-owner-user', 'submission-1')).resolves.toMatchObject({
        id: 'submission-1',
      });
    });
  });

  describe('group submission member isolation', () => {
    it('rejects a non-member or removed member from accessing a group submission', async () => {
      const { service, prisma } = buildAccessService();
      prisma.submission.findUnique.mockResolvedValue({
        id: 'submission-group-1',
        subjectId: 'subject-1',
        studentId: null,
        group: {
          members: [
            { studentId: 'student-member-1', status: 'ACTIVE' },
            { studentId: 'student-removed', status: 'REMOVED' },
          ],
        },
      });
      prisma.studentProfile.findUnique.mockResolvedValue({ id: 'student-profile-removed', userId: 'student-removed' });
      prisma.subject.findUnique.mockResolvedValue({ id: 'subject-1', isOpen: true, groupEnabled: true, maxGroupSize: 4 });
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-removed', studentId: 'student-profile-removed', subjectId: 'subject-1' });

      await expect(
        service.requireStudentCanAccessSubmission('student-removed', 'submission-group-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('teacher cannot review submissions from another teacher\'s subject', () => {
    it('rejects a teacher trying to review a submission from a subject they do not own', async () => {
      const { service, prisma } = buildAccessService();
      prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher-profile-attacker', userId: 'teacher-attacker-user' });
      prisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        subject: { id: 'subject-1', teacherId: 'teacher-profile-owner' },
        task: null,
      });

      await expect(
        service.requireTeacherCanReviewSubmission('teacher-attacker-user', 'submission-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows a teacher to review submissions from their own subject', async () => {
      const { service, prisma } = buildAccessService();
      prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher-profile-owner', userId: 'teacher-owner-user' });
      prisma.submission.findUnique.mockResolvedValue({
        id: 'submission-1',
        subject: { id: 'subject-1', teacherId: 'teacher-profile-owner' },
        task: null,
      });

      await expect(service.requireTeacherCanReviewSubmission('teacher-owner-user', 'submission-1')).resolves.toMatchObject({
        teacher: { id: 'teacher-profile-owner' },
      });
    });
  });

  describe('file download ownership enforcement', () => {
    it('rejects a student trying to download a file belonging to another student', async () => {
      const { service, prisma } = buildAccessService();
      prisma.submissionFile.findFirst.mockResolvedValue({
        id: 'file-1',
        relativePath: 'submissions/file-1.pdf',
        submission: { studentId: 'student-owner-user', group: null },
      });

      await expect(
        service.requireUserCanDownloadFile('student-attacker-user', 'STUDENT', 'submissions/file-1.pdf'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
