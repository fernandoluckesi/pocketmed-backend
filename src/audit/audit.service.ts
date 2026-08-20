import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import * as crypto from 'crypto';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditAction, AuditResourceType } from './audit.constants';
import { CreateAuditEventInput, AuditRequestContext } from './audit.types';
import { getRequestContext } from './request-context';

/**
 * Central audit service — REQ-AUD-033.
 * All modules MUST use this service instead of inserting directly into audit_events.
 *
 * Phase 2: Computes SHA-256 hash chain for tamper detection (REQ-AUD-045).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  /** In-memory cache of the last event hash to avoid DB lookup on every insert */
  private lastEventHash: string | null = null;

  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditRepository: Repository<AuditEvent>,
  ) {
    // Initialize last hash from DB on startup
    this.initializeLastHash();
  }

  private async initializeLastHash() {
    try {
      const lastEvent = await this.auditRepository.findOne({
        where: {},
        order: { createdAt: 'DESC' },
        select: ['eventHash'],
      });
      this.lastEventHash = lastEvent?.eventHash || null;
    } catch {
      // Table may not exist yet during first migration
      this.lastEventHash = null;
    }
  }

  /**
   * Compute SHA-256 hash of an event's canonical representation.
   * Uses a deterministic JSON serialization of key fields.
   */
  private computeEventHash(event: AuditEvent, previousHash: string | null): string {
    const canonical = JSON.stringify({
      id: event.id,
      tenantId: event.tenantId,
      actorUserId: event.actorUserId,
      actorRole: event.actorRole,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      patientId: event.patientId,
      success: event.success,
      reason: event.reason,
      timestamp: event.timestamp?.toISOString(),
      requestId: event.requestId,
      correlationId: event.correlationId,
      previousHash: previousHash,
    });

    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Core method: record an audit event.
   * Can optionally receive a QueryRunner to participate in the same transaction (REQ-AUD-003).
   */
  async record(input: CreateAuditEventInput, queryRunner?: QueryRunner): Promise<AuditEvent> {
    const ctx = getRequestContext() || ({} as Partial<AuditRequestContext>);

    const event = new AuditEvent();
    event.tenantId = ctx.tenantId || null;
    event.actorUserId = ctx.userId || null;
    event.actorRole = ctx.role || null;
    event.action = input.action;
    event.resourceType = input.resourceType;
    event.resourceId = input.resourceId || null;
    event.patientId = input.patientId || null;
    event.success = input.success;
    event.reason = input.reason || null;
    event.timestamp = new Date();
    event.ipAddress = ctx.ipAddress || null;
    event.userAgent = ctx.userAgent || null;
    event.sessionId = ctx.sessionId || null;
    event.requestId = ctx.requestId || null;
    event.correlationId = ctx.correlationId || null;
    event.changedFields = input.changedFields || null;
    event.metadata = input.metadata || null;

    // Phase 2: Hash chain
    event.previousHash = this.lastEventHash;

    // Save first to get the generated ID
    let saved: AuditEvent;
    if (queryRunner) {
      saved = await queryRunner.manager.save(AuditEvent, event);
    } else {
      saved = await this.auditRepository.save(event);
    }

    // Compute hash with the generated ID and update
    const eventHash = this.computeEventHash(saved, saved.previousHash);
    saved.eventHash = eventHash;

    if (queryRunner) {
      await queryRunner.manager.update(AuditEvent, saved.id, { eventHash });
    } else {
      await this.auditRepository.update(saved.id, { eventHash });
    }

    // Update in-memory last hash
    this.lastEventHash = eventHash;

    saved.eventHash = eventHash;
    return saved;
  }

  // --- Convenience methods ---

  async recordCreate(
    resourceType: AuditResourceType,
    resourceId: string,
    opts?: { patientId?: string; metadata?: Record<string, unknown>; queryRunner?: QueryRunner },
  ) {
    return this.record(
      {
        action: AuditAction.CREATE,
        resourceType,
        resourceId,
        patientId: opts?.patientId,
        success: true,
        metadata: opts?.metadata,
      },
      opts?.queryRunner,
    );
  }

  async recordRead(
    resourceType: AuditResourceType,
    resourceId: string,
    opts?: { patientId?: string; metadata?: Record<string, unknown>; queryRunner?: QueryRunner },
  ) {
    return this.record(
      {
        action: AuditAction.READ,
        resourceType,
        resourceId,
        patientId: opts?.patientId,
        success: true,
        metadata: opts?.metadata,
      },
      opts?.queryRunner,
    );
  }

  async recordUpdate(
    resourceType: AuditResourceType,
    resourceId: string,
    changedFields: Record<string, { before?: unknown; after?: unknown }>,
    opts?: { patientId?: string; metadata?: Record<string, unknown>; queryRunner?: QueryRunner },
  ) {
    return this.record(
      {
        action: AuditAction.UPDATE,
        resourceType,
        resourceId,
        patientId: opts?.patientId,
        success: true,
        changedFields,
        metadata: opts?.metadata,
      },
      opts?.queryRunner,
    );
  }

  async recordDelete(
    resourceType: AuditResourceType,
    resourceId: string,
    opts?: { patientId?: string; reason?: string; metadata?: Record<string, unknown>; queryRunner?: QueryRunner },
  ) {
    return this.record(
      {
        action: AuditAction.DELETE,
        resourceType,
        resourceId,
        patientId: opts?.patientId,
        success: true,
        reason: opts?.reason,
        metadata: opts?.metadata,
      },
      opts?.queryRunner,
    );
  }

  async recordAccessDenied(
    resourceType: AuditResourceType,
    opts?: { resourceId?: string; patientId?: string; reason?: string; metadata?: Record<string, unknown> },
  ) {
    return this.record({
      action: AuditAction.ACCESS_DENIED,
      resourceType,
      resourceId: opts?.resourceId,
      patientId: opts?.patientId,
      success: false,
      reason: opts?.reason || 'INSUFFICIENT_PERMISSION',
      metadata: opts?.metadata,
    });
  }

  async recordSecurityEvent(
    action: AuditAction,
    opts?: {
      resourceType?: AuditResourceType;
      resourceId?: string;
      patientId?: string;
      success?: boolean;
      reason?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.record({
      action,
      resourceType: opts?.resourceType || AuditResourceType.USER,
      resourceId: opts?.resourceId,
      patientId: opts?.patientId,
      success: opts?.success ?? true,
      reason: opts?.reason,
      metadata: opts?.metadata,
    });
  }

  // --- Query methods ---

  async findAll(filters: {
    tenantId?: string;
    userId?: string;
    patientId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    requestId?: string;
    correlationId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: AuditEvent[]; total: number; page: number; limit: number }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100);
    const skip = (page - 1) * limit;

    const qb = this.auditRepository.createQueryBuilder('audit');

    if (filters.tenantId) qb.andWhere('audit.tenantId = :tenantId', { tenantId: filters.tenantId });
    if (filters.userId) qb.andWhere('audit.actorUserId = :userId', { userId: filters.userId });
    if (filters.patientId) qb.andWhere('audit.patientId = :patientId', { patientId: filters.patientId });
    if (filters.resourceType) qb.andWhere('audit.resourceType = :resourceType', { resourceType: filters.resourceType });
    if (filters.resourceId) qb.andWhere('audit.resourceId = :resourceId', { resourceId: filters.resourceId });
    if (filters.action) qb.andWhere('audit.action = :action', { action: filters.action });
    if (filters.success !== undefined) qb.andWhere('audit.success = :success', { success: filters.success });
    if (filters.startDate) qb.andWhere('audit.timestamp >= :startDate', { startDate: filters.startDate });
    if (filters.endDate) qb.andWhere('audit.timestamp <= :endDate', { endDate: filters.endDate });
    if (filters.ipAddress) qb.andWhere('audit.ipAddress = :ipAddress', { ipAddress: filters.ipAddress });
    if (filters.requestId) qb.andWhere('audit.requestId = :requestId', { requestId: filters.requestId });
    if (filters.correlationId) qb.andWhere('audit.correlationId = :correlationId', { correlationId: filters.correlationId });

    qb.orderBy('audit.timestamp', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<AuditEvent | null> {
    return this.auditRepository.findOne({ where: { id } });
  }

  /**
   * Get total event count (used by monitoring).
   */
  async countAll(): Promise<number> {
    return this.auditRepository.count();
  }

  /**
   * Get events in chronological order for integrity verification.
   */
  async findChronological(skip: number, take: number): Promise<AuditEvent[]> {
    return this.auditRepository.find({
      order: { createdAt: 'ASC' },
      skip,
      take,
    });
  }

  /**
   * Recompute hash for verification purposes.
   */
  computeHashForVerification(event: AuditEvent): string {
    return this.computeEventHash(event, event.previousHash);
  }

  /**
   * Count events matching criteria (used by anomaly detection).
   */
  async countByCriteria(criteria: {
    action?: string;
    actorUserId?: string;
    ipAddress?: string;
    since: Date;
  }): Promise<number> {
    const qb = this.auditRepository.createQueryBuilder('audit');
    qb.where('audit.timestamp >= :since', { since: criteria.since });
    if (criteria.action) qb.andWhere('audit.action = :action', { action: criteria.action });
    if (criteria.actorUserId) qb.andWhere('audit.actorUserId = :actorUserId', { actorUserId: criteria.actorUserId });
    if (criteria.ipAddress) qb.andWhere('audit.ipAddress = :ipAddress', { ipAddress: criteria.ipAddress });
    return qb.getCount();
  }

  /**
   * Find distinct actors accessing a patient's data in a time window (anomaly detection).
   */
  async countDistinctActorsForPatient(patientId: string, since: Date): Promise<number> {
    const result = await this.auditRepository
      .createQueryBuilder('audit')
      .select('COUNT(DISTINCT audit.actorUserId)', 'count')
      .where('audit.patientId = :patientId', { patientId })
      .andWhere('audit.timestamp >= :since', { since })
      .getRawOne();
    return parseInt(result?.count || '0', 10);
  }

  /**
   * Delete events older than a given date (retention policy).
   * This is the ONLY permitted delete operation on audit_events — used by the retention scheduler.
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.auditRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :date', { date })
      .execute();
    return result.affected || 0;
  }

  /**
   * Enrich the current request context with user info (called after authentication).
   */
  enrichContext(data: { userId?: string; role?: string; tenantId?: string; sessionId?: string }) {
    const ctx = getRequestContext();
    if (ctx) {
      if (data.userId) ctx.userId = data.userId;
      if (data.role) ctx.role = data.role;
      if (data.tenantId) ctx.tenantId = data.tenantId;
      if (data.sessionId) ctx.sessionId = data.sessionId;
    }
  }
}
