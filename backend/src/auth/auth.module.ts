import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { AuthThrottleService } from './auth-throttle.service';
import { AccountActionTokenService } from './account-action-token.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MailModule } from '../mail/mail.module';

@Global()
@Module({
  imports: [AuditLogsModule, MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    AuthThrottleService,
    AccountActionTokenService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    AuthSessionService,
    AuthThrottleService,
    AccountActionTokenService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
