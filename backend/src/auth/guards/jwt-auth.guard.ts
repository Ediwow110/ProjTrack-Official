import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../token.service';
import { ROLES_KEY } from './roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const authHeader = request.headers?.authorization || request.headers?.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const payload: any = this.tokenService.verifyAccessToken(token);
    if (!payload?.sub || payload.type !== 'access') {
      throw new UnauthorizedException('Invalid access token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User session is no longer active.');
    }
    if (String(user.role) !== String(payload.role)) {
      throw new UnauthorizedException('User role changed. Sign in again.');
    }

    if (requiredRoles?.length && !requiredRoles.includes(String(user.role))) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    request.user = {
      ...payload,
      sub: user.id,
      role: user.role,
      email: user.email,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    return true;
  }
}
