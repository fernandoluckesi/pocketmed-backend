import { AuditAction, AuditResourceType } from './audit.constants';

/**
 * Context propagated per-request via AsyncLocalStorage.
 * REQ-AUD-034
 */
export interface AuditRequestContext {
  userId?: string;
  tenantId?: string;
  role?: string;
  requestId: string;
  correlationId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Input payload for creating an audit event.
 * REQ-AUD-033
 */
export interface CreateAuditEventInput {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  patientId?: string;
  success: boolean;
  reason?: string;
  changedFields?: Record<string, { before?: unknown; after?: unknown }>;
  metadata?: Record<string, unknown>;
}
