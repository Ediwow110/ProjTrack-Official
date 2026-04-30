import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  subjectId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  leaderUserId?: string;
}

export class JoinGroupByCodeDto {
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsString()
  @MaxLength(32)
  code!: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class TeacherActivityDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  openAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  closeAt?: string;

  @IsOptional()
  @IsBoolean()
  allowLateSubmission?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyByEmail?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  submissionMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxFileSizeMb?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  acceptedFileTypes?: string[];

  @IsOptional()
  @IsBoolean()
  externalLinksAllowed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  notificationTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notificationBody?: string;
}

export class NotifySubjectDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;
}

export class SubjectRestrictionsDto {
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsBoolean()
  groupEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowLateSubmission?: boolean;

  @IsOptional()
  @IsBoolean()
  allowLate?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  minGroupSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxGroupSize?: number;

  @IsOptional()
  @IsUrl()
  resourceUrl?: string;
}

export class MemberIdDto {
  @IsOptional()
  @IsString()
  memberId?: string;
}
