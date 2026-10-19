import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentGenerationService } from './document-generation.service';
import { DocumentAccessTokenService } from './document-access-token.service';
import { SignatureModule } from './signature/signature.module';
import { SignatureSimulatorController } from './signature-simulator.controller';
import { UploadModule } from '../upload/upload.module';

/** Shared document-generation + signature infrastructure, imported by
 * PrescriptionsModule, ReportsModule, and future document-producing modules. */
@Module({
  imports: [
    UploadModule,
    SignatureModule,
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
  controllers: [SignatureSimulatorController],
  providers: [DocumentGenerationService, DocumentAccessTokenService],
  exports: [DocumentGenerationService, DocumentAccessTokenService, SignatureModule],
})
export class DocumentsModule {}
