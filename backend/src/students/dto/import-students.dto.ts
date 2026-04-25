import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class ImportStudentsDto {
  @IsString()
  fileName!: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  rows?: Record<string, string>[];

  @IsOptional()
  @IsString()
  fileBase64?: string;

  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  fileType?: 'xlsx' | 'csv';

  @IsOptional()
  @IsString()
  csvText?: string;
}
