import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditService } from './audit.service';
import { AuditIntegrityService } from './audit-integrity.service';
import { AuditAnomalyService } from './audit-anomaly.service';
import { AuditRetentionService } from './audit-retention.service';
import { AuditController } from './audit.controller';

/**
 * Global audit module — available to all other modules without explicit import.
 * REQ-AUD-033
 *
 * Phase 2: Includes integrity verification, anomaly detection, and retention services.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  providers: [
    AuditService,
    AuditIntegrityService,
    AuditAnomalyService,
    AuditRetentionService,
  ],
  controllers: [AuditController],
  exports: [AuditService, AuditIntegrityService, AuditAnomalyService, AuditRetentionService],
})
export class AuditModule {}
