import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditResourceType } from '../audit/audit.constants';
import { AuditFilterDto } from '../audit/dto/audit-filter.dto';

/**
 * Audit trail for the back office. Separate from `/audit/*` because that one is
 * scoped to clinic admins; this is platform-wide internal staff access.
 */
@ApiTags('Backoffice - Audit')
@Controller('backoffice/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles('backoffice')
export class BackofficeAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('events')
  @ApiOperation({ summary: 'List audit events (approvals, rejections, access, etc.)' })
  @ApiResponse({ status: 200, description: 'Paginated audit events' })
  async listEvents(@Query() filters: AuditFilterDto) {
    // Reading the audit trail is itself an auditable event.
    await this.auditService.recordSecurityEvent(AuditAction.READ, {
      resourceType: AuditResourceType.AUDIT_EVENT,
      metadata: { filters, scope: 'backoffice' },
    });

    return this.auditService.findAll({
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });
  }
}
