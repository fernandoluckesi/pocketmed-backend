import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../entities/patient.entity';
import { Doctor } from '../../entities/doctor.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
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

    return { userId: user.id, email: user.email, type: user.type };
  }
}
