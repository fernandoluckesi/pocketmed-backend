import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { MedicalRecordRetentionService } from './medical-record-retention.service';

/**
 * Finishes what a deletion request started: once the CFM retention period
 * expires, the clinical record that was being kept is finally erased.
 *
 * Without this job, "retained for 20 years" silently means "kept forever",
 * which would turn a lawful retention into an indefinite one — the LGPD
 * authorises keeping the data *while* the legal duty lasts (art. 16), not
 * beyond it.
 *
 * Runs daily. The work is tiny and idempotent: on most days it finds nothing,
 * since it only matches rows whose `retentionUntil` has actually lapsed.
 */
@Injectable()
export class MedicalRecordRetentionCronService {
  private readonly logger = new Logger(MedicalRecordRetentionCronService.name);

  constructor(
    private readonly retentionService: MedicalRecordRetentionService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'medical-record-retention-purge' })
  async handleExpiredRetentions(): Promise<{ purged: number }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    let purged = 0;
    try {
      const expired = await this.retentionService.findExpiredRetentions(queryRunner);
      if (expired.length === 0) return { purged: 0 };

      this.logger.log(`Found ${expired.length} account(s) with expired retention period.`);

      // One transaction per account rather than one for all of them: a
      // failure on a single record must not block every other expiry, and
      // the operation is irreversible enough to be worth isolating.
      for (const { id, type } of expired) {
        await queryRunner.startTransaction();
        try {
          await this.retentionService.purgeMedicalRecord(queryRunner, id, {
            isDoctor: type === 'doctor',
          });
          // Only now can the row itself go: migration 1835 put RESTRICT on
          // the clinical FKs, so the documents must be gone first.
          const table = type === 'doctor' ? 'doctors' : 'patients';
          await queryRunner.query(`DELETE FROM \`${table}\` WHERE \`id\` = ?`, [id]);

          await queryRunner.commitTransaction();
          purged++;
        } catch (error) {
          await queryRunner.rollbackTransaction();
          // Logged and skipped: a record still referenced by something this
          // job doesn't know about needs a human, not a retry loop.
          this.logger.error(
            `Failed to purge ${type} ${id} after retention expiry — skipping. ` +
              `This record needs manual review.`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      this.logger.log(`Retention purge complete: ${purged}/${expired.length} erased.`);
      return { purged };
    } catch (error) {
      this.logger.error('Retention purge job failed', error);
      return { purged };
    } finally {
      await queryRunner.release();
    }
  }
}
