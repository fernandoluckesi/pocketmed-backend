import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { getRequestContext } from './request-context';

/**
 * Interceptor that enriches the audit request context with authenticated user info.
 * Runs after the auth guard has populated req.user.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user) {
      const ctx = getRequestContext();
      if (ctx) {
        ctx.userId = user.userId || user.sub;
        ctx.role = user.role || user.type;
        ctx.tenantId = user.activeClinicId || undefined;
        ctx.sessionId = user.sessionId || undefined;
      }
    }

    return next.handle();
  }
}
