import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditAction } from './audit.constants';

export interface AnomalyAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, unknown>;
  detectedAt: Date;
}

export interface AnomalyThresholds {
  /** Max login failures from same IP in the time window */
  loginFailuresPerIp: number;
  /** Max login failures for same user in the time window */
  loginFailuresPerUser: number;
  /** Max patient data accesses by a single actor in the time window */
  patientAccessesPerActor: number;
  /** Max distinct actors accessing same patient in the time window */
  distinctActorsPerPatient: number;
  /** Max bulk operations (exports/downloads) per actor in the time window */
  bulkOperationsPerActor: number;
  /** Time window in minutes for threshold calculations */
  timeWindowMinutes: number;
}

const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  loginFailuresPerIp: 10,
  loginFailuresPerUser: 5,
  patientAccessesPerActor: 50,
  distinctActorsPerPatient: 10,
  bulkOperationsPerActor: 20,
  timeWindowMinutes: 15,
};

/**
 * Anomaly detection service for the audit system.
 * Detects suspicious patterns such as brute force attacks, unusual access volumes,
 * and unauthorized data access patterns.
 */
@Injectable()
export class AuditAnomalyService {
  private readonly logger = new Logger(AuditAnomalyService.name);
  private thresholds: AnomalyThresholds;
  private alerts: AnomalyAlert[] = [];

  constructor(private readonly auditService: AuditService) {
    this.thresholds = { ...DEFAULT_THRESHOLDS };
  }

  /**
   * Update thresholds dynamically (e.g., from config or admin API).
   */
  setThresholds(thresholds: Partial<AnomalyThresholds>) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  getThresholds(): AnomalyThresholds {
    return { ...this.thresholds };
  }

  /**
   * Get recent alerts (in-memory buffer).
   */
  getRecentAlerts(limit = 50): AnomalyAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clear alerts older than the given duration.
   */
  clearOldAlerts(olderThanMs = 24 * 60 * 60 * 1000) {
    const cutoff = new Date(Date.now() - olderThanMs);
    this.alerts = this.alerts.filter((a) => a.detectedAt > cutoff);
  }

  /**
   * Run all anomaly checks. Called periodically by the scheduler.
   */
  async runChecks(): Promise<AnomalyAlert[]> {
    const newAlerts: AnomalyAlert[] = [];
    const since = new Date(Date.now() - this.thresholds.timeWindowMinutes * 60 * 1000);

    try {
      const bruteForceAlerts = await this.checkBruteForce(since);
      newAlerts.push(...bruteForceAlerts);
    } catch (err) {
      this.logger.error('Brute force check failed', err);
    }

    try {
      const bulkAlerts = await this.checkBulkOperations(since);
      newAlerts.push(...bulkAlerts);
    } catch (err) {
      this.logger.error('Bulk operations check failed', err);
    }

    if (newAlerts.length > 0) {
      this.alerts.push(...newAlerts);
      // Keep buffer bounded
      if (this.alerts.length > 1000) {
        this.alerts = this.alerts.slice(-500);
      }

      for (const alert of newAlerts) {
        this.logger.warn(`[ANOMALY] ${alert.severity.toUpperCase()}: ${alert.message}`, alert.details);
      }
    }

    return newAlerts;
  }

  /**
   * Check for brute force login attempts.
   */
  private async checkBruteForce(since: Date): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    // Check total LOGIN_FAILURE count in window
    const totalFailures = await this.auditService.countByCriteria({
      action: AuditAction.LOGIN_FAILURE,
      since,
    });

    if (totalFailures >= this.thresholds.loginFailuresPerIp * 3) {
      alerts.push({
        type: 'BRUTE_FORCE_GLOBAL',
        severity: 'critical',
        message: `${totalFailures} login failures detected in the last ${this.thresholds.timeWindowMinutes} minutes`,
        details: { totalFailures, windowMinutes: this.thresholds.timeWindowMinutes },
        detectedAt: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Check for abnormal bulk operations (downloads, exports).
   */
  private async checkBulkOperations(since: Date): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    const downloadCount = await this.auditService.countByCriteria({
      action: AuditAction.DOWNLOAD,
      since,
    });

    const exportCount = await this.auditService.countByCriteria({
      action: AuditAction.EXPORT,
      since,
    });

    const totalBulk = downloadCount + exportCount;

    if (totalBulk >= this.thresholds.bulkOperationsPerActor) {
      alerts.push({
        type: 'BULK_OPERATIONS_SPIKE',
        severity: 'high',
        message: `${totalBulk} bulk operations (downloads/exports) in the last ${this.thresholds.timeWindowMinutes} minutes`,
        details: { downloadCount, exportCount, windowMinutes: this.thresholds.timeWindowMinutes },
        detectedAt: new Date(),
      });
    }

    return alerts;
  }

  /**
   * Real-time check: call this after each LOGIN_FAILURE to detect brute force on specific IP/user.
   */
  async checkLoginFailure(ipAddress?: string, userId?: string): Promise<AnomalyAlert | null> {
    const since = new Date(Date.now() - this.thresholds.timeWindowMinutes * 60 * 1000);

    if (ipAddress) {
      const count = await this.auditService.countByCriteria({
        action: AuditAction.LOGIN_FAILURE,
        ipAddress,
        since,
      });

      if (count >= this.thresholds.loginFailuresPerIp) {
        const alert: AnomalyAlert = {
          type: 'BRUTE_FORCE_IP',
          severity: 'high',
          message: `${count} login failures from IP ${ipAddress} in ${this.thresholds.timeWindowMinutes} minutes`,
          details: { ipAddress, count, threshold: this.thresholds.loginFailuresPerIp },
          detectedAt: new Date(),
        };
        this.alerts.push(alert);
        this.logger.warn(`[ANOMALY] ${alert.message}`);
        return alert;
      }
    }

    if (userId) {
      const count = await this.auditService.countByCriteria({
        action: AuditAction.LOGIN_FAILURE,
        actorUserId: userId,
        since,
      });

      if (count >= this.thresholds.loginFailuresPerUser) {
        const alert: AnomalyAlert = {
          type: 'BRUTE_FORCE_USER',
          severity: 'high',
          message: `${count} login failures for user ${userId} in ${this.thresholds.timeWindowMinutes} minutes`,
          details: { userId, count, threshold: this.thresholds.loginFailuresPerUser },
          detectedAt: new Date(),
        };
        this.alerts.push(alert);
        this.logger.warn(`[ANOMALY] ${alert.message}`);
        return alert;
      }
    }

    return null;
  }

  /**
   * Real-time check: call after patient data access to detect unusual patterns.
   */
  async checkPatientAccessAnomaly(patientId: string): Promise<AnomalyAlert | null> {
    const since = new Date(Date.now() - this.thresholds.timeWindowMinutes * 60 * 1000);

    const distinctActors = await this.auditService.countDistinctActorsForPatient(patientId, since);

    if (distinctActors >= this.thresholds.distinctActorsPerPatient) {
      const alert: AnomalyAlert = {
        type: 'UNUSUAL_PATIENT_ACCESS',
        severity: 'medium',
        message: `${distinctActors} distinct actors accessed patient ${patientId} in ${this.thresholds.timeWindowMinutes} minutes`,
        details: { patientId, distinctActors, threshold: this.thresholds.distinctActorsPerPatient },
        detectedAt: new Date(),
      };
      this.alerts.push(alert);
      this.logger.warn(`[ANOMALY] ${alert.message}`);
      return alert;
    }

    return null;
  }
}
