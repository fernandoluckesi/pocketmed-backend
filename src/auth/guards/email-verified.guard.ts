import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator';

/**
 * The real email-verification gate. A self-registered patient/doctor gets a
 * valid token at login even before confirming their email (so the client can
 * reach the verify/resend endpoints), but this guard blocks that token from
 * every protected business route until `emailVerified` is true.
 *
 * Runs after `JwtAuthGuard` (which populates `request.user.emailVerified`).
 * Public routes are skipped (no user), and routes explicitly marked with
 * `@AllowUnverified()` — the verify/resend/logout/delete endpoints — are let
 * through so verification can actually be completed. Role profiles
 * (secretary/clinic-admin) and back office tokens never carry an
 * `emailVerified` flag, so they are unaffected.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowUnverified) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    // No user (shouldn't happen on a protected route) or an account type that
    // doesn't go through email verification → nothing to enforce.
    if (!user || user.emailVerified === undefined || user.emailVerified === null) {
      return true;
    }

    if (user.emailVerified === false) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirme seu email para continuar.',
      });
    }

    return true;
  }
}
