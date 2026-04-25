import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsIn(['ADMIN', 'TEACHER', 'STUDENT'])
  expectedRole!: 'ADMIN' | 'TEACHER' | 'STUDENT';
}
