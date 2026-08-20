import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

/**
 * Audit event entity — append-only table (REQ-AUD-036).
 * No UPDATE or DELETE operations should ever be performed on this entity.
 *
 * Phase 2: event_hash and previous_hash form a hash chain for tamper detection (REQ-AUD-045).
 */
@Entity('audit_events')
@Index('IDX_audit_patient_timestamp', ['patientId', 'timestamp'])
@Index('IDX_audit_actor_timestamp', ['actorUserId', 'timestamp'])
@Index('IDX_audit_resource', ['resourceType', 'resourceId'])
@Index('IDX_audit_tenant_timestamp', ['tenantId', 'timestamp'])
@Index('IDX_audit_action_timestamp', ['action', 'timestamp'])
@Index('IDX_audit_request_id', ['requestId'])
@Index('IDX_audit_correlation_id', ['correlationId'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  actorRole: string | null;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 100 })
  resourceType: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  resourceId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  patientId: string | null;

  @Column({ type: 'tinyint', width: 1 })
  success: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ type: 'datetime', precision: 6 })
  timestamp: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  requestId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  correlationId: string | null;

  @Column({ type: 'json', nullable: true })
  changedFields: Record<string, { before?: unknown; after?: unknown }> | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  /** SHA-256 hash of the previous event — forms a chain for tamper detection */
  @Column({ type: 'varchar', length: 64, nullable: true })
  previousHash: string | null;

  /** SHA-256 hash of this event's canonical representation */
  @Column({ type: 'varchar', length: 64, nullable: true })
  eventHash: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}
