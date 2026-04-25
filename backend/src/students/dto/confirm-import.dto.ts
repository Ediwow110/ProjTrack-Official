import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString } from 'class-validator';

export class ConfirmImportDto {
  @IsString()
  batchId!: string;

  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  acceptedRowIndexes!: number[];
}
