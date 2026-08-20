import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditIntegrityService } from './audit-integrity.service';
import { AuditAnomalyService } from './audit-anomaly.service';
import { AuditRetentionService } from './audit-retention.service';
import { AuditFilterDto } from './dto/audit-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditAction, AuditResourceType } from './audit.constants';

/**
 * REQ-AUD-048/049 — Protected audit query endpoints.
 * Only admin roles can access audit logs.
 * REQ-AUD-050 — Access to audit logs is itself audited.
 *
 * Phase 2: Adds integrity verification, monitoring, anomaly alerts, and retention endpoints.
 */
@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly integrityService: AuditIntegrityService,
    private readonly anomalyService: AuditAnomalyService,
    private readonly retentionService: AuditRetentionService,
  ) {}

  // ─── Events Query ───────────────────────────────────────────────

  @Get('events')
  @Roles('admin')
  @ApiOperation({ summary: 'List audit events with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of audit events' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async listEvents(@Query() filters: AuditFilterDto, @CurrentUser() user: any) {
    // REQ-AUD-050 — Audit the access to audit logs
    await this.auditService.recordSecurityEvent(AuditAction.READ, {
      resourceType: AuditResourceType.AUDIT_EVENT,
      metadata: { filters },
    });

    const result = await this.auditService.findAll({
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });

    return result;
  }

  @Get('events/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get a single audit event by ID' })
  @ApiResponse({ status: 200, description: 'Audit event details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getEvent(@Param('id') id: string, @CurrentUser() user: any) {
    // REQ-AUD-050
    await this.auditService.recordSecurityEvent(AuditAction.READ, {
      resourceType: AuditResourceType.AUDIT_EVENT,
      resourceId: id,
    });

    const event = await this.auditService.findById(id);
    if (!event) {
      return { message: 'Audit event not found' };
    }
    return event;
  }

  // ─── Integrity ──────────────────────────────────────────────────

  @Get('integrity/full')
  @Roles('admin')
  @ApiOperation({ summary: 'Run full hash chain integrity verification' })
  @ApiResponse({ status: 200, description: 'Integrity check result' })
  async verifyFullIntegrity(@CurrentUser() user: any) {
    await this.auditService.recordSecurityEvent(AuditAction.READ, {
      resourceType: AuditResourceType.AUDIT_EVENT,
      metadata: { operation: 'integrity_full_check' },
    });

    return this.integrityService.verifyFullChain();
  }

  @Get('integrity/recent')
  @Roles('admin')
  @ApiOperation({ summary: 'Quick integrity check on last 100 events' })
  @ApiResponse({ status: 200, description: 'Recent integrity check result' })
  async verifyRecentIntegrity(@CurrentUser() user: any) {
    await this.auditService.recordSecurityEvent(AuditAction.READ, {
      resourceType: AuditResourceType.AUDIT_EVENT,
      metadata: { operation: 'integrity_recent_check' },
    });

    return this.integrityService.verifyRecentEvents(100);
  }

  // ─── Monitoring ─────────────────────────────────────────────────

  @Get('monitoring/health')
  @Roles('admin')
  @ApiOperation({ summary: 'Audit system health: stats, integrity quick-check, retention policy' })
  @ApiResponse({ status: 200, description: 'Audit system health report' })
  async getHealth(@CurrentUser() user: any) {
    const [totalEvents, integrityResult, retentionPolicy, alerts] = await Promise.all([
      this.auditService.countAll(),
      this.integrityService.verifyRecentEvents(50),
      this.retentionService.getPolicy(),
      Promise.resolve(this.anomalyService.getRecentAlerts(10)),
    ]);

    return {
      status: integrityResult.valid ? 'healthy' : 'integrity_broken',
      totalEvents,
      integrity: {
        valid: integrityResult.valid,
        lastChecked: integrityResult.checkedAt,
        eventsChecked: integrityResult.checkedEvents,
        durationMs: integrityResult.durationMs,
      },
      retention: retentionPolicy,
      anomalies: {
        recentAlertCount: alerts.length,
        alerts: alerts.slice(0, 5),
      },
      thresholds: this.anomalyService.getThresholds(),
    };
  }

  @Get('monitoring/alerts')
  @Roles('admin')
  @ApiOperation({ summary: 'Get recent anomaly alerts' })
  @ApiResponse({ status: 200, description: 'List of anomaly alerts' })
  async getAlerts(@CurrentUser() user: any) {
    return {
      alerts: this.anomalyService.getRecentAlerts(50),
      thresholds: this.anomalyService.getThresholds(),
    };
  }

  @Post('monitoring/run-checks')
  @Roles('admin')
  @ApiOperation({ summary: 'Manually trigger anomaly detection checks' })
  @ApiResponse({ status: 200, description: 'Anomaly check results' })
  async runAnomalyChecks(@CurrentUser() user: any) {
    await this.auditService.recordSecurityEvent(AuditAction.READ, {
      resourceType: AuditResourceType.AUDIT_EVENT,
      metadata: { operation: 'manual_anomaly_check' },
    });

    const newAlerts = await this.anomalyService.runChecks();
    return {
      newAlerts,
      totalAlerts: this.anomalyService.getRecentAlerts().length,
    };
  }

  // ─── Retention ──────────────────────────────────────────────────

  @Get('retention/policy')
  @Roles('admin')
  @ApiOperation({ summary: 'Get current retention policy configuration' })
  @ApiResponse({ status: 200, description: 'Retention policy details' })
  async getRetentionPolicy() {
    return this.retentionService.getPolicy();
  }

  @Post('retention/run')
  @Roles('admin')
  @ApiOperation({ summary: 'Manually trigger retention cleanup' })
  @ApiResponse({ status: 200, description: 'Retention cleanup result' })
  async runRetention(@CurrentUser() user: any) {
    await this.auditService.recordSecurityEvent(AuditAction.DELETE, {
      resourceType: AuditResourceType.AUDIT_EVENT,
      metadata: { operation: 'manual_retention_cleanup' },
    });

    return this.retentionService.runManualCleanup();
  }
}
