import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadScopeDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  scope?: string;
}

export class UploadBase64Dto extends UploadScopeDto {
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @IsString()
  @MaxLength(30_000_000)
  contentBase64!: string;
}

