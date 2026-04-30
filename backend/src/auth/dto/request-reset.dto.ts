import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class RequestResetDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['student', 'teacher', 'admin', 'STUDENT', 'TEACHER', 'ADMIN'])
  role?: 'student' | 'teacher' | 'admin' | 'STUDENT' | 'TEACHER' | 'ADMIN';
}
