import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RetryMailJobDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class RetryMailJobsDto extends RetryMailJobDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids?: string[];
}

export class ArchiveOldMailJobsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  olderThanDays?: number;
}

export class TestEmailDto {
  @IsEmail()
  to!: string;
}

