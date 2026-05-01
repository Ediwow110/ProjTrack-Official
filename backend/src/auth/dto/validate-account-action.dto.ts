import { IsString } from 'class-validator';

export class ValidateAccountActionDto {
  @IsString()
  ref!: string;

  @IsString()
  token!: string;
}
