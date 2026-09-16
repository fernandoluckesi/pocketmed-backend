import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/** Route prefix that hosts the platform back office API. */
export const BACKOFFICE_PREFIX = 'backoffice';

/**
 * Enforces a hard boundary between the two products sharing this API:
 *
 * 1. A back office token (internal Hispora staff) can ONLY reach `/backoffice/*`.
 *    Without this, staff tokens would pass through controllers that declare no
 *    `@Roles` (e.g. `/patients`) and reach clinical data they must never see.
 * 2. A clinical token (doctor / clinic admin / secretary / patient) can NEVER
 *    reach `/backoffice/*`, regardless of their clinic role.
 *
 * This is a global guard, so it also protects endpoints added in the future that
 * forget to declare `@Roles`.
 */
@Injectable()
export class BackofficeBoundaryGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    // Unauthenticated requests are already handled by JwtAuthGuard.
    if (!user) {
      return true;
    }

    const path: string = request?.route?.path || request?.url || '';
    const isBackofficeRoute = this.isBackofficeRoute(path);
    const isBackofficeUser = user.type === BACKOFFICE_PREFIX;

    if (isBackofficeUser && !isBackofficeRoute) {
      throw new ForbiddenException('Contas de backoffice só podem acessar recursos do backoffice.');
    }

    if (!isBackofficeUser && isBackofficeRoute) {
      throw new ForbiddenException('Apenas contas da equipe Hispora podem acessar o backoffice.');
    }

    return true;
  }

  /** Matches `/backoffice`, `/backoffice/...` and any global prefix variant. */
  private isBackofficeRoute(path: string): boolean {
    const normalized = path.split('?')[0].replace(/^\/+/, '');
    const segments = normalized.split('/');
    return segments.includes(BACKOFFICE_PREFIX);
  }
}
