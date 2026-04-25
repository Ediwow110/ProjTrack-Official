import { IsNotEmpty, IsString } from 'class-validator';

export class ActivateAccountDto {
  @IsString()
  @IsNotEmpty()
  ref!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword!: string;
}
