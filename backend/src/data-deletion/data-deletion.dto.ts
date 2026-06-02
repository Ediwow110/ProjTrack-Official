import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDataDeletionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsString()
  @MaxLength(100)
  confirmationPhrase!: string;
}

export class ReviewDataDeletionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;
}
