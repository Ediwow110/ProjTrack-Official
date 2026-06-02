import { IsOptional, IsString, MaxLength } from 'class-validator';

export const DATA_DELETION_EXECUTION_CONFIRMATION_TEXT = 'EXECUTE DATA DELETION';

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

export class ExecuteDeletionDto {
  @IsString()
  backupRunId!: string;

  @IsString()
  @MaxLength(255)
  confirmationPhrase!: string;
}
