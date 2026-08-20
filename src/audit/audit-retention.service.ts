import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit.service';

/**
 * Retention policy configuration.
 *
 * According to Brazilian regulations (CFM Resolution 1821/2007):
 * - Medical records must be kept for at least 20 years after the last entry.
 * - For audit purposes in this system, we apply a configurable retention period.
 *
 * Default: 7 years (2555 days) — a conservative middle ground considering LGPD and health regulations.
 * This can be overridden via environment variable AUDIT_RETENTION_DAYS.
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);
  private readonly retentionDays: number;
  private readonly enabled: boolean;

  constructor(
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays = parseInt(
      this.configService.get<string>('AUDIT_RETENTION_DAYS') || '2555',
      10,
    );
    this.enabled =
      (this.configService.get<string>('AUDIT_RETENTION_ENABLED') || 'false').toLowerCase() === 'true';

    if (this.enabled) {
      this.logger.log(`Audit retention enabled: events older than ${this.retentionDays} days will be purged`);
    } else {
      this.logger.log('Audit retention is DISABLED. Events will be kept indefinitely.');
    }
  }

  /**
   * Get retention policy info.
   */
  getPolicy() {
    return {
      enabled: this.enabled,
      retentionDays: this.retentionDays,
      retentionYears: Math.round(this.retentionDays / 365 * 10) / 10,
      note: 'CFM Resolution 1821/2007 requires 20+ years for medical records. Audit logs follow a separate policy.',
    };
  }

  /**
   * Scheduled job: runs daily at 3:00 AM to purge old audit events.
   * Only executes if AUDIT_RETENTION_ENABLED=true.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'audit-retention-cleanup' })
  async handleRetentionCleanup() {
    if (!this.enabled) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    this.logger.log(`Running retention cleanup: removing events before ${cutoffDate.toISOString()}`);

    try {
      const deleted = await this.auditService.deleteOlderThan(cutoffDate);
      this.logger.log(`Retention cleanup complete: ${deleted} events purged`);
    } catch (error) {
      this.logger.error('Retention cleanup failed', error);
    }
  }

  /**
   * Manual trigger for retention cleanup (can be called from admin endpoint).
   */
  async runManualCleanup(): Promise<{ deleted: number; cutoffDate: Date }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const deleted = await this.auditService.deleteOlderThan(cutoffDate);
    this.logger.log(`Manual retention cleanup: ${deleted} events purged (before ${cutoffDate.toISOString()})`);

    return { deleted, cutoffDate };
  }
}
