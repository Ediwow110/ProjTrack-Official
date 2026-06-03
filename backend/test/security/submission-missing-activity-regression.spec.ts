import { NotFoundException } from '@nestjs/common';
import { SubmissionsService } from '../../src/submissions/submissions.service';

function buildSubmissionsService(overrides: Partial<Record<string, any>> = {}) {
  const submissionRepository = overrides.submissionRepository ?? {
    createOrUpdateSubmission: jest.fn(),
    findExistingSubmission: jest.fn(),
    findSubmissionById: jest.fn(),
  };
  const subjectRepository = overrides.subjectRepository ?? {
    findActivityById: jest.fn(),
    findSubjectById: jest.fn(),
    listGroupsBySubject: jest.fn(),
  };
  const userRepository = overrides.userRepository ?? {
    findById: jest.fn(),
  };
  const notificationRepository = overrides.notificationRepository ?? {
    create: jest.fn(),
  };
  const auditLogs = overrides.auditLogs ?? {
    record: jest.fn(),
  };
  const filesService = overrides.filesService ?? {
    resolvePendingUploadsForSubmission: jest.fn(async () => []),
  };
  const mailService = overrides.mailService ?? {
    queueTransactional: jest.fn(),
  };
  const prisma = overrides.prisma ?? {
    studentProfile: { findUnique: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    group: { findFirst: jest.fn() },
    systemSetting: { findFirst: jest.fn() },
    submissionEvent: { create: jest.fn() },
  };
  const access = overrides.access ?? {
    requireStudentEnrolledInSubject: jest.fn(async () => ({ subject: { isOpen: true } })),
  };

  const service = new SubmissionsService(
    submissionRepository,
    subjectRepository,
    userRepository,
    notificationRepository,
    auditLogs,
    filesService,
    mailService,
    prisma,
    access,
  );

  return {
    service,
    submissionRepository,
    subjectRepository,
    userRepository,
    notificationRepository,
    auditLogs,
    filesService,
    mailService,
    prisma,
    access,
  };
}

describe('SubmissionsService - missing activity regression (QWEN-FINDING-003)', () => {
  it('throws NotFoundException when createOrUpdateSubmission returns null for missing activity', async () => {
    const { service, submissionRepository, subjectRepository, access } = buildSubmissionsService();

    subjectRepository.findActivityById.mockResolvedValue({
      id: 'activity-1',
      subjectId: 'subject-1',
      isOpen: true,
      allowLateSubmission: true,
      submissionMode: 'INDIVIDUAL',
      acceptedFileTypes: [],
      maxFileSizeMb: 10,
      externalLinksAllowed: true,
    });

    access.requireStudentEnrolledInSubject.mockResolvedValue({
      subject: { isOpen: true },
    });

    // Key mock: repository returns null to simulate missing task
    submissionRepository.createOrUpdateSubmission.mockResolvedValue(null);

    const body = {
      activityId: 'activity-1',
      title: 'Test Submission',
      userId: 'user-1',
      files: [],
    };

    await expect(service.submit(body)).rejects.toThrow(NotFoundException);
    await expect(service.submit(body)).rejects.toThrow('Activity not found.');

    expect(submissionRepository.createOrUpdateSubmission).toHaveBeenCalled();
  });
});