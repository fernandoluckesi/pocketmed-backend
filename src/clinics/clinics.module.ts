import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../entities/clinic.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Doctor } from '../entities/doctor.entity';
import { UploadModule } from '../upload/upload.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clinic, ClinicMembership, Doctor]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION'),
        },
      }),
      inject: [ConfigService],
    }),
    UploadModule,
    EmailModule,
  ],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
