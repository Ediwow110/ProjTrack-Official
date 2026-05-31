import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, of, tap } from 'rxjs';
import { CacheService } from './cache.service';

/**
 * Interceptor that caches GET responses with a configurable TTL.
 * The cache key is built from: prefix + user ID + normalized request URL.
 *
 * Usage:
 *   @UseInterceptors(new CacheInterceptor('subjects', 30_000))
 *   async teacherSubjects(@Req() req) { ... }
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    @Inject(CacheService) private readonly cache: CacheService,
    private readonly prefix: string,
    private readonly ttlMs = 60_000,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    const userId = String((request as any).user?.sub ?? 'anonymous');
    const key = this.buildKey(userId, request.originalUrl ?? request.url);

    const cached = this.cache.get<unknown>(key);
    if (cached !== undefined) {
      return of(cached);
    }

    return next.handle().pipe(
      tap((response) => {
        if (response !== undefined) {
          this.cache.set(key, response, this.ttlMs);
        }
      }),
    );
  }

  private buildKey(userId: string, url: string): string {
    // Normalize URL: strip pagination params that change often
    const normalized = url.replace(/[?&](take|skip|page)=[^&]+/g, '').replace(/&&/g, '&');
    return `${this.prefix}:${userId}:${normalized}`;
  }
}
