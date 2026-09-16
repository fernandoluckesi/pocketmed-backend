import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DoctorDocument } from '../entities/doctor-document.entity';
import { Doctor } from '../entities/doctor.entity';
import { BackofficeUser } from '../entities/backoffice-user.entity';
import { BackofficeVerificationService } from './backoffice-verification.service';
import { BackofficeVerificationController } from './backoffice-verification.controller';
import { BackofficeAuthService } from './backoffice-auth.service';
import { BackofficeAuthController } from './backoffice-auth.controller';
import { BackofficeAuditController } from './backoffice-audit.controller';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    EmailModule,
    NotificationsModule,
    TypeOrmModule.forFeature([DoctorDocument, Doctor, BackofficeUser]),
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
  ],
  controllers: [
    BackofficeAuthController,
    BackofficeVerificationController,
    BackofficeAuditController,
  ],
  providers: [BackofficeAuthService, BackofficeVerificationService],
  exports: [BackofficeVerificationService],
})
export class BackofficeModule {}
