import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UserStatus } from '@prisma/client';

type UserPatch = {
  password?: string | null;
  status?: UserStatus;
  updatedAt?: string;
  firstName?: string;
  lastName?: string;
};

type StudentPlacementInput = {
  sectionId?: string | null;
  section?: string;
  academicYearLevelId?: string | null;
  yearLevelName?: string;
  course?: string;
  yearLevel?: number;
  academicYearId?: string | null;
  academicYear?: string;
};

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  getPrimaryLoginIdentifier(user: any) {
    if (user.role === 'STUDENT') {
      return String(user.studentProfile?.studentNumber ?? user.studentNumber ?? user.email);
    }
    if (user.role === 'TEACHER') {
      return String(user.teacherProfile?.employeeId ?? user.employeeId ?? user.email);
    }
    return String(user.email);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { studentProfile: true, teacherProfile: true },
    });
  }

  async findByLoginIdentifier(identifier: string, role: 'ADMIN' | 'TEACHER' | 'STUDENT') {
    const normalized = identifier.trim().toLowerCase();
    if (!normalized) return null;

    const where: any = { role };
    if (role === 'STUDENT') {
      where.OR = [
        { email: normalized },
        { studentProfile: { is: { studentNumber: { equals: identifier.trim(), mode: 'insensitive' } } } },
      ];
    } else if (role === 'TEACHER') {
      where.OR = [
        { email: normalized },
        { teacherProfile: { is: { employeeId: { equals: identifier.trim(), mode: 'insensitive' } } } },
      ];
    } else {
      where.email = normalized;
    }

    return this.prisma.user.findFirst({
      where,
      include: { studentProfile: true, teacherProfile: true },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true, teacherProfile: true },
    });
  }

  async listAll() {
    return this.prisma.user.findMany({
      include: {
        studentProfile: {
          include: {
            academicYear: true,
            academicYearLevel: true,
            section: {
              include: {
                academicYear: true,
                academicYearLevel: true,
              },
            },
          },
        },
        teacherProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listByRole(role: 'ADMIN' | 'TEACHER' | 'STUDENT') {
    return this.prisma.user.findMany({
      where: { role },
      include: {
        studentProfile: {
          include: {
            academicYear: true,
            academicYearLevel: true,
            section: {
              include: {
                academicYear: true,
                academicYearLevel: true,
              },
            },
          },
        },
        teacherProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listStudents() {
    return this.listByRole('STUDENT');
  }

  async findAcademicYearByName(name: string) {
    const value = String(name ?? '')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    if (!value) return null;
    return this.prisma.academicYear.findFirst({
      where: {
        name: {
          equals: value,
          mode: 'insensitive',
        },
      },
    });
  }

  async findSectionByPlacement(input: StudentPlacementInput) {
    const sectionId = String(input.sectionId ?? '').trim();
    if (sectionId) {
      return this.prisma.section.findUnique({
        where: { id: sectionId },
        include: { academicYear: true },
      });
    }

    const sectionName = String(input.section ?? '').trim();
    if (!sectionName) return null;

    const course = String(input.course ?? '').trim();
    const academicYearName = String(input.academicYear ?? '').trim();
    const yearLevelName = String(input.yearLevelName ?? '').trim();
    const normalizedYearLevel =
      typeof input.yearLevel === 'number' && Number.isInteger(input.yearLevel)
        ? input.yearLevel
        : Number(input.yearLevel ?? 0) || undefined;

    return this.prisma.section.findFirst({
      where: {
        name: {
          equals: sectionName,
          mode: 'insensitive',
        },
        academicYearId: String(input.academicYearId ?? '').trim() || undefined,
        academicYear:
          academicYearName && !input.academicYearId
            ? {
                is: {
                  name: {
                    equals: academicYearName,
                    mode: 'insensitive',
                  },
                },
              }
            : undefined,
        academicYearLevelId: String(input.academicYearLevelId ?? '').trim() || undefined,
        course: course
          ? {
              equals: course,
              mode: 'insensitive',
            }
          : undefined,
        yearLevel:
          yearLevelName && normalizedYearLevel === undefined ? undefined : normalizedYearLevel,
        yearLevelName: yearLevelName
          ? {
              equals: yearLevelName,
              mode: 'insensitive',
            }
          : undefined,
      },
      include: { academicYear: true, academicYearLevel: true },
    });
  }

  async updateAuthFields(userId: string, patch: UserPatch) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: patch.password,
        status: patch.status,
        updatedAt: patch.updatedAt ? new Date(patch.updatedAt) : undefined,
        firstName: patch.firstName,
        lastName: patch.lastName,
      },
    });
  }

  async createStudent(input: {
    email: string;
    firstName: string;
    lastName: string;
    middleInitial?: string;
    studentNumber: string;
    sectionId?: string | null;
    section?: string;
    academicYearLevelId?: string | null;
    yearLevelName?: string;
    course?: string;
    yearLevel?: number;
    academicYearId?: string | null;
    academicYear?: string;
    status: UserStatus;
  }) {
    const [section, academicYear, academicYearLevel] = await Promise.all([
      this.findSectionByPlacement({
        sectionId: input.sectionId,
        section: input.section,
        academicYearLevelId: input.academicYearLevelId,
        yearLevelName: input.yearLevelName,
        course: input.course,
        yearLevel: input.yearLevel,
        academicYearId: input.academicYearId,
        academicYear: input.academicYear,
      }),
      input.academicYearId
        ? this.prisma.academicYear.findUnique({ where: { id: input.academicYearId } })
        : this.findAcademicYearByName(String(input.academicYear ?? '')),
      input.academicYearLevelId
        ? this.prisma.academicYearLevel.findUnique({ where: { id: input.academicYearLevelId } })
        : null,
    ]);

    const academicYearId = section?.academicYearId ?? academicYear?.id ?? input.academicYearId ?? null;
    const academicYearLevelId =
      section?.academicYearLevelId ??
      academicYearLevel?.id ??
      input.academicYearLevelId ??
      null;
    const course = input.course || section?.course || undefined;
    const yearLevel = input.yearLevel ?? section?.yearLevel ?? undefined;
    const yearLevelName =
      input.yearLevelName ||
      section?.yearLevelName ||
      academicYearLevel?.name ||
      undefined;

    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        role: 'STUDENT',
        status: input.status,
        firstName: input.firstName,
        lastName: input.lastName,
        studentProfile: {
          create: {
            studentNumber: input.studentNumber,
            middleInitial: String(input.middleInitial ?? '').trim() || null,
            sectionId: section?.id,
            academicYearId,
            academicYearLevelId,
            course,
            yearLevel,
            yearLevelName,
          },
        },
      },
      include: {
        studentProfile: {
          include: {
            academicYear: true,
            academicYearLevel: true,
            section: {
              include: {
                academicYear: true,
                academicYearLevel: true,
              },
            },
          },
        },
      },
    });
  }
}
