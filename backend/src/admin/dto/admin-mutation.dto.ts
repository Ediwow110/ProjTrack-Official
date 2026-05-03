import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAdminDto {
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MaxLength(80)
  lastName!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  office?: string;

  @IsOptional()
  @IsBoolean()
  sendActivationEmail?: boolean;
}


export class CreateCourseDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() description?: string;
  @IsNumber() @IsOptional() sortOrder?: number;
}

export class CreateAcademicYearDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;
}

export class CreateAcademicYearLevelDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  sortOrder?: number;
  @IsString() @IsOptional() courseId?: string;
}

export class CreateSectionDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  program?: string;

  @IsOptional()
  @IsString()
  yearLevelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  yearLevelName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  yearLevel?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  academicYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  adviserName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class StudentMutationDto {
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  middleInitial?: string;

  @IsString()
  @MaxLength(80)
  lastName!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(40)
  studentNumber!: string;

  @IsString()
  @MaxLength(80)
  section!: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  academicYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  course?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  yearLevel?: string;

  @IsOptional()
  @IsString()
  yearLevelId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  yearLevelName?: string;
}

export class TeacherMutationDto {
  @IsString()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MaxLength(80)
  lastName!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;
}

export class SubjectMutationDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  teacherId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsBoolean()
  groupEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowLateSubmission?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  sectionIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  sectionCodes?: string[];
}

export class AdminSubmissionCreateDto {
  @IsString()
  taskId!: string;

  @IsString()
  subjectId!: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(40)
  status!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  grade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  submittedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  externalLinks?: string[];
}

export class AdminSubmissionUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  grade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  submittedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  externalLinks?: string[];
}

export class NoteDto {
  @IsString()
  @MaxLength(5000)
  note!: string;
}

export class AcademicSettingsDto {
  @IsString()
  @MaxLength(80)
  schoolYear!: string;

  @IsString()
  @MaxLength(80)
  semester!: string;

  @IsString()
  @MaxLength(64)
  submissionStart!: string;

  @IsString()
  @MaxLength(64)
  submissionEnd!: string;

  @IsString()
  @MaxLength(500)
  latePolicy!: string;

  @IsString()
  @MaxLength(40)
  lateDeduction!: string;
}

export class SystemSettingsDto {
  @IsString()
  @MaxLength(160)
  schoolName!: string;

  @IsEmail()
  email!: string;

  @IsEmail()
  notifEmail!: string;

  @IsString()
  @MaxLength(3)
  minPassLen!: string;

  @IsString()
  @MaxLength(3)
  maxFailedLogins!: string;

  @IsString()
  @MaxLength(6)
  sessionTimeout!: string;

  @IsBoolean()
  allowRegistration!: boolean;

  @IsBoolean()
  requireEmailVerification!: boolean;

  @IsBoolean()
  twoFactorAdmin!: boolean;

  @IsString()
  @MaxLength(40)
  backupFrequency!: string;

  @IsBoolean()
  accountAccessEmailsEnabled!: boolean;

  @IsBoolean()
  classroomActivityEmailsEnabled!: boolean;

  @IsBoolean()
  classroomActivitySystemNotificationsEnabled!: boolean;
}

export class SystemToolRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  confirmation?: string;

  @IsOptional()
  @IsBoolean()
  backupConfirmed?: boolean;
}

export class ImportSystemToolBackupDto {
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @IsString()
  @MaxLength(30_000_000)
  contentBase64!: string;
}

export class BulkMoveDto {
  @IsOptional()
  @IsString()
  sourceSectionId?: string;

  @IsOptional()
  @IsString()
  destSectionId?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  dest?: string;

  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids!: string[];
}

export class IdsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids?: string[];
}

export class BroadcastDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(5000)
  body!: string;

  @IsIn(['ALL', 'STUDENTS', 'TEACHERS', 'ADMINS'])
  audience!: 'ALL' | 'STUDENTS' | 'TEACHERS' | 'ADMINS';

  @IsIn(['system', 'email', 'both'])
  channel!: 'system' | 'email' | 'both';
}

export class AnnouncementDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  audience?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'SCHEDULED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  publishAt?: string;
}

export class AssignGroupLeaderDto {
  @IsString()
  memberId!: string;
}
