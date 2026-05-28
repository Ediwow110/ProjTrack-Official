import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
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

describe('service-level authorization abuse gate', () => {
  it('rejects missing authenticated student identity for submission access', async () => {
    const { service } = buildAccessService();

    await expect(service.requireStudentCanAccessSubmission('', 'submission-1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a student trying to access another student individual submission', async () => {
    const { service, prisma } = buildAccessService();
    prisma.submission.findUnique.mockResolvedValue({
      id: 'submission-1',
      subjectId: 'subject-1',
      studentId: 'student-owner-user',
      group: null,
    });
    prisma.studentProfile.findUnique.mockResolvedValue({ id: 'student-profile-2', userId: 'student-attacker-user' });
    prisma.subject.findUnique.mockResolvedValue({ id: 'subject-1', isOpen: true, groupEnabled: false, maxGroupSize: 1 });
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-1', studentId: 'student-profile-2', subjectId: 'subject-1' });

    await expect(
      service.requireStudentCanAccessSubmission('student-attacker-user', 'submission-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a student to access their own individual submission', async () => {
    const { service, prisma } = buildAccessService();
    prisma.submission.findUnique.mockResolvedValue({
      id: 'submission-1',
      subjectId: 'subject-1',
      studentId: 'student-owner-user',
      group: null,
    });
    prisma.studentProfile.findUnique.mockResolvedValue({ id: 'student-profile-1', userId: 'student-owner-user' });
    prisma.subject.findUnique.mockResolvedValue({ id: 'subject-1', isOpen: true, groupEnabled: false, maxGroupSize: 1 });
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-1', studentId: 'student-profile-1', subjectId: 'subject-1' });

    await expect(service.requireStudentCanAccessSubmission('student-owner-user', 'submission-1')).resolves.toMatchObject({
      id: 'submission-1',
      studentId: 'student-owner-user',
    });
  });

  it('rejects a student who is not an active member of the submission group', async () => {
    const { service, prisma } = buildAccessService();
    prisma.submission.findUnique.mockResolvedValue({
      id: 'submission-1',
      subjectId: 'subject-1',
      studentId: null,
      group: {
        members: [
          { studentId: 'student-owner-user', status: 'ACTIVE' },
          { studentId: 'student-attacker-user', status: 'REMOVED' },
        ],
      },
    });
    prisma.studentProfile.findUnique.mockResolvedValue({ id: 'student-profile-2', userId: 'student-attacker-user' });
    prisma.subject.findUnique.mockResolvedValue({ id: 'subject-1', isOpen: true, groupEnabled: true, maxGroupSize: 4 });
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-2', studentId: 'student-profile-2', subjectId: 'subject-1' });

    await expect(
      service.requireStudentCanAccessSubmission('student-attacker-user', 'submission-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an active group member to access a group submission', async () => {
    const { service, prisma } = buildAccessService();
    prisma.submission.findUnique.mockResolvedValue({
      id: 'submission-1',
      subjectId: 'subject-1',
      studentId: null,
      group: {
        members: [{ studentId: 'student-member-user', status: 'ACTIVE' }],
      },
    });
    prisma.studentProfile.findUnique.mockResolvedValue({ id: 'student-profile-3', userId: 'student-member-user' });
    prisma.subject.findUnique.mockResolvedValue({ id: 'subject-1', isOpen: true, groupEnabled: true, maxGroupSize: 4 });
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enrollment-3', studentId: 'student-profile-3', subjectId: 'subject-1' });

    await expect(service.requireStudentCanAccessSubmission('student-member-user', 'submission-1')).resolves.toMatchObject({
      id: 'submission-1',
    });
  });

  it('rejects a teacher trying to review another teacher subject submission', async () => {
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

  it('allows a teacher to review their own subject submission', async () => {
    const { service, prisma } = buildAccessService();
    prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher-profile-owner', userId: 'teacher-owner-user' });
    prisma.submission.findUnique.mockResolvedValue({
      id: 'submission-1',
      subject: { id: 'subject-1', teacherId: 'teacher-profile-owner' },
      task: null,
    });

    await expect(service.requireTeacherCanReviewSubmission('teacher-owner-user', 'submission-1')).resolves.toMatchObject({
      teacher: { id: 'teacher-profile-owner' },
      submission: { id: 'submission-1' },
    });
  });

  it('rejects a student trying to download another student file', async () => {
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

  it('allows a student to download their own file', async () => {
    const { service, prisma } = buildAccessService();
    prisma.submissionFile.findFirst.mockResolvedValue({
      id: 'file-1',
      relativePath: 'submissions/file-1.pdf',
      submission: { studentId: 'student-owner-user', group: null },
    });

    await expect(
      service.requireUserCanDownloadFile('student-owner-user', 'STUDENT', 'submissions/file-1.pdf'),
    ).resolves.toMatchObject({ id: 'file-1' });
  });

  it('rejects a teacher trying to download a file from another teacher subject', async () => {
    const { service, prisma } = buildAccessService();
    prisma.submissionFile.findFirst.mockResolvedValue({
      id: 'file-1',
      relativePath: 'submissions/file-1.pdf',
      submission: { subject: { id: 'subject-1', teacherId: 'teacher-profile-owner' }, group: null },
    });
    prisma.teacherProfile.findUnique.mockResolvedValue({ id: 'teacher-profile-attacker', userId: 'teacher-attacker-user' });

    await expect(
      service.requireUserCanDownloadFile('teacher-attacker-user', 'TEACHER', 'submissions/file-1.pdf'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin file access only after lookup without requiring owner scope', async () => {
    const { service, prisma } = buildAccessService();
    prisma.submissionFile.findFirst.mockResolvedValue(null);

    await expect(service.requireUserCanDownloadFile('admin-user', 'ADMIN', 'missing-file.pdf')).resolves.toBeNull();
  });

  it('returns not found instead of leaking file existence to non-admin when file does not exist', async () => {
    const { service, prisma } = buildAccessService();
    prisma.submissionFile.findFirst.mockResolvedValue(null);

    await expect(service.requireUserCanDownloadFile('student-user', 'STUDENT', 'missing-file.pdf')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
