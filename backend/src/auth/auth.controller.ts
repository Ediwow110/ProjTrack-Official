import { Body, Controller, Get, Headers, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { ValidateAccountActionDto } from './dto/validate-account-action.dto';
import { RequestResetDto } from './dto/request-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  clearRefreshCookie,
  refreshTokenFromCookie,
  setRefreshCookie,
  stripRefreshTokenInProduction,
} from './session-cookie';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private requestMeta(req: any) {
    return {
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers?.['user-agent'] ? String(req.headers['user-agent']) : undefined,
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body, this.requestMeta(req));
    if (result.refreshToken) {
      setRefreshCookie(res, result.refreshToken);
    }
    return stripRefreshTokenInProduction(result);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: RefreshTokenDto = {}, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = body.refreshToken || refreshTokenFromCookie(req);
    const result = await this.authService.refresh({ refreshToken }, this.requestMeta(req));
    if (result.refreshToken) {
      setRefreshCookie(res, result.refreshToken);
    }
    return stripRefreshTokenInProduction(result);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Body() body: LogoutDto = {}, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = body.refreshToken || refreshTokenFromCookie(req);
    const result = await this.authService.logout({ refreshToken }, this.requestMeta(req));
    clearRefreshCookie(res);
    return result;
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.authService.me(authorization);
  }

  @Post('activate')
  activate(@Body() body: ActivateAccountDto) {
    return this.authService.activate(body);
  }

  @Post('activate/validate')
  validateActivation(@Body() body: ValidateAccountActionDto) {
    return this.authService.validateActivation(body);
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
