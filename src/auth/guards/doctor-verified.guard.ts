import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProfessionalRole } from '../professional-role.enum';

/**
 * Blocks doctors whose professional verification isn't APPROVED from reaching
 * routes marked with `@RequireDoctorVerified()` (real patient data). Patients
 * and secretaries are never subject to this check — secretaries have no
 * credentials of their own, mirroring the banner logic in the frontend.
 */
@Injectable()
export class DoctorVerifiedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresVerification = this.reflector.getAllAndOverride<boolean>(
      'requireDoctorVerified',
      [context.getHandler(), context.getClass()],
    );

    if (!requiresVerification) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user || user.type !== 'doctor' || user.role === ProfessionalRole.SECRETARY) {
      return true;
    }

    if (user.verificationStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Conclua a verificação profissional para acessar dados de pacientes.',
      );
    }

    return true;
  }
}
