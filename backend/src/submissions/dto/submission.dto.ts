import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class SubmissionFileReferenceDto {
  @IsString()
  @MaxLength(80)
  uploadId!: string;

  @IsString()
  @MaxLength(180)
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500_000)
  sizeKb!: number;

}

export class StudentSubmitDto {
  @IsString()
  activityId!: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsUrl()
  externalLink?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  externalLinks?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SubmissionFileReferenceDto)
  files?: SubmissionFileReferenceDto[];
}

export class TeacherReviewSubmissionDto {
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
}
