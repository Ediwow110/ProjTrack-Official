import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDryRunExecutionDto {
  // no body needed, but for future
}

export class VerifyBackupDto {
  @IsString()
  backupRunId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  verificationRef?: string;
}
