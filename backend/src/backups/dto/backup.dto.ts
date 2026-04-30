import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BackupSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', 'custom'])
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(5)
  timeOfDay?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weeklyDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  monthlyDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(744)
  customIntervalHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  retentionCount?: number;
}

export class BackupRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  backupType?: string;
}

export class BackupRestoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  confirmation?: string;
}

