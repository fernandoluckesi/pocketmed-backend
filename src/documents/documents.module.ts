import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentGenerationService } from './document-generation.service';
import { DocumentAccessTokenService } from './document-access-token.service';
import { DocumentAccessService } from './document-access.service';
import { DocumentAccessController } from './document-access.controller';
import { SignatureModule } from './signature/signature.module';
import { SignatureSimulatorController } from './signature-simulator.controller';
import { UploadModule } from '../upload/upload.module';
import { Prescription } from '../entities/prescription.entity';
import { ExamRequest } from '../entities/exam-request.entity';

/** Shared document-generation + signature infrastructure, imported by
 * PrescriptionsModule, ReportsModule, and future document-producing modules. */
@Module({
  imports: [
    UploadModule,
    SignatureModule,
    // Entities only (not PrescriptionsModule/ExamRequestsModule) to avoid a
    // circular import — those modules already import DocumentsModule.
    TypeOrmModule.forFeature([Prescription, ExamRequest]),
    // Deliberately a SEPARATE JwtModule instance/secret from AuthModule's:
    // document-access tokens are handed out to unauthenticated recipients
    // (e.g. a shadow patient's email), so they must never be verifiable with
    // the same secret that signs full login sessions, and vice versa.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('DOCUMENT_ACCESS_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SignatureSimulatorController, DocumentAccessController],
  providers: [DocumentGenerationService, DocumentAccessTokenService, DocumentAccessService],
  exports: [DocumentGenerationService, DocumentAccessTokenService, DocumentAccessService, SignatureModule],
})
export class DocumentsModule {}
