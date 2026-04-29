import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SAFE_USER_SELECT } from '../access/policies/subject-access.policy';

@Injectable()
export class SubmissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async resolveTeacherProfileId(teacherId?: string) {
    if (!teacherId) return undefined;
    const direct = await this.prisma.teacherProfile.findUnique({ where: { id: teacherId } });
    if (direct) return direct.id;
    const byUser = await this.prisma.teacherProfile.findUnique({ where: { userId: teacherId } });
    return byUser?.id ?? teacherId;
  }

  async listSubmissions() {
    return this.prisma.submission.findMany({
      include: {
        task: true,
        files: true,
        reviewer: { select: SAFE_USER_SELECT },
        student: { select: SAFE_USER_SELECT },
        group: { include: { members: { include: { student: { select: SAFE_USER_SELECT } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findSubmissionById(id: string) {
    return this.prisma.submission.findUnique({
      where: { id },
      include: {
        task: true,
        files: true,
        reviewer: { select: SAFE_USER_SELECT },
        student: { select: SAFE_USER_SELECT },
        group: { include: { members: { include: { student: { select: SAFE_USER_SELECT } } } } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async listStudentSubmissions(userId: string, status?: string) {
    return this.prisma.submission.findMany({
      where: {
        ...(status ? { status } : {}),
        OR: [{ studentId: userId }, { group: { members: { some: { studentId: userId } } } }],
      },
      include: {
        task: true,
        files: true,
        student: { select: SAFE_USER_SELECT },
        group: { include: { members: { include: { student: { select: SAFE_USER_SELECT } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findExistingSubmission(activityId: string, userId?: string, groupId?: string) {
    return this.prisma.submission.findFirst({
      where: groupId ? { taskId: activityId, groupId } : { taskId: activityId, studentId: userId },
      include: {
        task: true,
        files: true,
        reviewer: { select: SAFE_USER_SELECT },
        student: { select: SAFE_USER_SELECT },
        group: { include: { members: { include: { student: { select: SAFE_USER_SELECT } } } } },
      },
    });
  }

  async listTeacherSubmissions(filters?: {
    teacherId?: string;
    section?: string;
    status?: string;
    subjectId?: string;
  }) {
    const resolvedTeacherId = await this.resolveTeacherProfileId(filters?.teacherId);
    const tasks = await this.prisma.submissionTask.findMany({
      where: resolvedTeacherId ? { subject: { teacherId: resolvedTeacherId } } : undefined,
      select: { id: true },
    });
    const taskIds = tasks.map((task) => task.id);

    return this.prisma.submission.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.subjectId ? { subjectId: filters.subjectId } : {}),
        ...(resolvedTeacherId ? { taskId: { in: taskIds } } : {}),
        ...(filters?.section
          ? {
              OR: [
                { student: { studentProfile: { section: { name: filters.section } } } },
                {
                  group: {
                    members: {
                      some: {
                        student: {
                          studentProfile: {
                            section: { name: filters.section },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        task: true,
        files: true,
        reviewer: { select: SAFE_USER_SELECT },
        student: { select: { ...SAFE_USER_SELECT, studentProfile: { include: { section: true } } } },
        group: {
          include: {
            members: {
              include: {
                student: {
                  select: { ...SAFE_USER_SELECT, studentProfile: { include: { section: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOrUpdateSubmission(body: {
    activityId: string;
    title?: string;
    userId: string;
    groupId?: string;
    description?: string;
    notes?: string;
    externalLinks?: string[];
    files?: { name: string; sizeKb: number; relativePath?: string }[];
    status?: string;
  }) {
    const task = await this.prisma.submissionTask.findUnique({ where: { id: body.activityId } });
    if (!task) return null;

    const existing = await this.findExistingSubmission(body.activityId, body.userId, body.groupId);
    if (existing) {
      await this.prisma.submissionFile.deleteMany({ where: { submissionId: existing.id } });
      return this.prisma.submission.update({
        where: { id: existing.id },
        data: {
          status: body.status || 'SUBMITTED',
          submittedAt: new Date(),
          submittedById: body.userId,
          title: body.title || task.title,
          feedback: 'Submission received.',
          description: body.description,
          notes: body.notes,
          externalLinks: body.externalLinks || [],
          files: {
            create: (body.files || []).map((file) => ({
              fileName: file.name,
              fileSize: file.sizeKb,
              relativePath: file.relativePath,
            })),
          },
        },
        include: {
          task: true,
          files: true,
          student: { select: SAFE_USER_SELECT },
          group: { include: { members: { include: { student: { select: SAFE_USER_SELECT } } } } },
        },
      });
    }

    try {
      return await this.prisma.submission.create({
        data: {
          taskId: body.activityId,
          subjectId: task.subjectId,
          studentId: body.groupId ? null : body.userId,
          groupId: body.groupId,
          submittedById: body.userId,
          title: body.title || task.title,
          status: body.status || 'SUBMITTED',
          submittedAt: new Date(),
          feedback: 'Submission received.',
          description: body.description,
          notes: body.notes,
          externalLinks: body.externalLinks || [],
          files: {
            create: (body.files || []).map((file) => ({
              fileName: file.name,
              fileSize: file.sizeKb,
              relativePath: file.relativePath,
            })),
          },
        },
        include: {
          task: true,
          files: true,
          student: { select: SAFE_USER_SELECT },
          group: { include: { members: { include: { student: { select: SAFE_USER_SELECT } } } } },
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          body.groupId
            ? 'A group submission already exists for this activity.'
            : 'A submission already exists for this activity and student.',
        );
      }
      throw error;
    }
  }

  async reviewSubmission(id: string, body: { status?: string; grade?: number; feedback?: string }) {
    return this.prisma.submission.update({
      where: { id },
      data: {
        status: body.status,
        grade: body.grade,
        feedback: body.feedback,
      },
      include: {
        task: true,
        files: true,
        reviewer: { select: SAFE_USER_SELECT },
        student: { select: SAFE_USER_SELECT },
        group: { include: { members: { include: { student: { select: SAFE_USER_SELECT } } } } },
      },
    });
  }
}
