import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../entities/patient.entity';
import { Doctor } from '../../entities/doctor.entity';
import { Secretary } from '../../entities/secretary.entity';
import { ClinicMembership } from '../../entities/clinic-membership.entity';
import { ProfessionalRole } from '../professional-role.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Secretary)
    private secretaryRepository: Repository<Secretary>,
    @InjectRepository(ClinicMembership)
    private clinicMembershipRepository: Repository<ClinicMembership>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Secretary login (role=secretary in JWT)
    if (payload.role === 'secretary') {
      const secretary = await this.secretaryRepository.findOne({ where: { id: payload.sub } });
      if (!secretary || !secretary.isActive) {
        throw new UnauthorizedException('Invalid token');
      }
      return {
        userId: secretary.id,
        email: secretary.email,
        type: 'doctor',
        role: ProfessionalRole.SECRETARY,
        activeClinicId: secretary.clinicId,
      };
    }

    let user: Patient | Doctor | null = null;

    if (payload.type === 'patient') {
      user = await this.patientRepository.findOne({ where: { id: payload.sub } });
    } else if (payload.type === 'doctor') {
      user = await this.doctorRepository.findOne({ where: { id: payload.sub } });
    } else {
      user = await this.patientRepository.findOne({ where: { id: payload.sub } });
      if (!user) {
        user = await this.doctorRepository.findOne({ where: { id: payload.sub } });
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    let role: string | null = null;
    let activeClinicId: string | null = null;

    if (user.type === 'doctor') {
      const membership = await this.clinicMembershipRepository.findOne({
        where: { professionalId: user.id, isActive: true },
        order: { createdAt: 'ASC' },
      });

      role = membership?.role || payload?.role || ProfessionalRole.DOCTOR;
      activeClinicId = membership?.clinicId || payload?.activeClinicId || null;
    }

    return {
      userId: user.id,
      email: user.email,
      type: user.type,
      role,
      activeClinicId,
    };
  }
}
