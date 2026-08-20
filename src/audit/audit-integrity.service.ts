import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from './audit.service';

export interface IntegrityCheckResult {
  valid: boolean;
  totalEvents: number;
  checkedEvents: number;
  brokenAt?: {
    eventId: string;
    position: number;
    expectedHash: string;
    actualHash: string;
  };
  checkedAt: Date;
  durationMs: number;
}

/**
 * Service responsible for verifying the integrity of the audit hash chain.
 * Detects any tampered, modified, or deleted events by walking the chain.
 */
@Injectable()
export class AuditIntegrityService {
  private readonly logger = new Logger(AuditIntegrityService.name);

  constructor(private readonly auditService: AuditService) {}

  /**
   * Verify the entire hash chain from the beginning.
   * Walks events in chronological order and recomputes each hash.
   * Returns the first broken link if found.
   *
   * @param batchSize Number of events to load per batch (for memory efficiency)
   */
  async verifyFullChain(batchSize = 500): Promise<IntegrityCheckResult> {
    const startTime = Date.now();
    const totalEvents = await this.auditService.countAll();

    if (totalEvents === 0) {
      return {
        valid: true,
        totalEvents: 0,
        checkedEvents: 0,
        checkedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
    }

    let offset = 0;
    let checkedEvents = 0;
    let previousHash: string | null = null;

    while (offset < totalEvents) {
      const events = await this.auditService.findChronological(offset, batchSize);

      if (events.length === 0) break;

      for (const event of events) {
        checkedEvents++;

        // Verify previous_hash links correctly
        if (event.previousHash !== previousHash) {
          this.logger.warn(
            `Integrity break: event ${event.id} at position ${checkedEvents} — previousHash mismatch`,
          );
          return {
            valid: false,
            totalEvents,
            checkedEvents,
            brokenAt: {
              eventId: event.id,
              position: checkedEvents,
              expectedHash: previousHash || 'null',
              actualHash: event.previousHash || 'null',
            },
            checkedAt: new Date(),
            durationMs: Date.now() - startTime,
          };
        }

        // Verify event_hash is correct
        if (event.eventHash) {
          const recomputedHash = this.auditService.computeHashForVerification(event);
          if (recomputedHash !== event.eventHash) {
            this.logger.warn(
              `Integrity break: event ${event.id} at position ${checkedEvents} — eventHash tampered`,
            );
            return {
              valid: false,
              totalEvents,
              checkedEvents,
              brokenAt: {
                eventId: event.id,
                position: checkedEvents,
                expectedHash: recomputedHash,
                actualHash: event.eventHash,
              },
              checkedAt: new Date(),
              durationMs: Date.now() - startTime,
            };
          }
        }

        previousHash = event.eventHash || null;
      }

      offset += batchSize;
    }

    this.logger.log(`Integrity check passed: ${checkedEvents} events verified`);

    return {
      valid: true,
      totalEvents,
      checkedEvents,
      checkedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Quick integrity check — verifies only the last N events.
   * Useful for periodic health checks without scanning the entire table.
   */
  async verifyRecentEvents(count = 100): Promise<IntegrityCheckResult> {
    const startTime = Date.now();
    const totalEvents = await this.auditService.countAll();

    if (totalEvents === 0) {
      return {
        valid: true,
        totalEvents: 0,
        checkedEvents: 0,
        checkedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
    }

    const startOffset = Math.max(0, totalEvents - count);
    const events = await this.auditService.findChronological(startOffset, count);

    let checkedEvents = 0;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      checkedEvents++;

      // Verify event_hash correctness
      if (event.eventHash) {
        const recomputedHash = this.auditService.computeHashForVerification(event);
        if (recomputedHash !== event.eventHash) {
          return {
            valid: false,
            totalEvents,
            checkedEvents,
            brokenAt: {
              eventId: event.id,
              position: startOffset + i + 1,
              expectedHash: recomputedHash,
              actualHash: event.eventHash,
            },
            checkedAt: new Date(),
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Verify chain linkage between consecutive events in this batch
      if (i > 0) {
        const expectedPrevious = events[i - 1].eventHash || null;
        if (event.previousHash !== expectedPrevious) {
          return {
            valid: false,
            totalEvents,
            checkedEvents,
            brokenAt: {
              eventId: event.id,
              position: startOffset + i + 1,
              expectedHash: expectedPrevious || 'null',
              actualHash: event.previousHash || 'null',
            },
            checkedAt: new Date(),
            durationMs: Date.now() - startTime,
          };
        }
      }
    }

    return {
      valid: true,
      totalEvents,
      checkedEvents,
      checkedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}
