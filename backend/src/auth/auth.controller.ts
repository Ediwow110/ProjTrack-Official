import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { RequestResetDto } from './dto/request-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private requestMeta(req: any) {
    const forwarded = String(req?.headers?.['x-forwarded-for'] ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)[0];
    return {
      ipAddress: forwarded || req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers?.['user-agent'] ? String(req.headers['user-agent']) : undefined,
    };
  }

  @Post('login')
  login(@Body() body: LoginDto, @Req() req: any) {
    return this.authService.login(body, this.requestMeta(req));
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }, @Req() req: any) {
    return this.authService.refresh(body, this.requestMeta(req));
  }

  @Post('logout')
  logout(@Body() body: { refreshToken?: string }, @Req() req: any) {
    return this.authService.logout(body, this.requestMeta(req));
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.authService.me(authorization);
  }

  @Post('activate')
  activate(@Body() body: ActivateAccountDto) {
    return this.authService.activate(body);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: RequestResetDto, @Req() req: any) {
    return this.authService.forgotPassword(body, this.requestMeta(req));
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto, @Req() req: any) {
    return this.authService.resetPassword(body, this.requestMeta(req));
  }
}
