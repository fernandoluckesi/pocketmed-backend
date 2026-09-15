import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BackofficeVerificationService } from './backoffice-verification.service';
import { ListSubmissionsQueryDto } from './dto/list-submissions.query.dto';
import { ApproveDocumentDto, RejectDocumentDto } from './dto/review-document.dto';

/**
 * Platform back office — doctor credential verification.
 *
 * Restricted to internal Hispora staff (`type: 'backoffice'`). Clinic roles
 * (admin/doctor/secretary) must never reach these endpoints.
 */
@ApiTags('Backoffice - Doctor Verification')
@Controller('backoffice/doctor-verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles('backoffice')
export class BackofficeVerificationController {
  constructor(private readonly verificationService: BackofficeVerificationService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Verification queue counters' })
  @ApiResponse({ status: 200, description: 'Counters by verification status' })
  async getStats() {
    return this.verificationService.getStats();
  }

  @Get('submissions')
  @ApiOperation({ summary: 'List doctor credential submissions for review' })
  @ApiResponse({ status: 200, description: 'Paginated submissions' })
  async listSubmissions(@Query() query: ListSubmissionsQueryDto) {
    return this.verificationService.listSubmissions(query);
  }

  @Get('submissions/:doctorId')
  @ApiOperation({ summary: 'Get a single submission with document files' })
  @ApiResponse({ status: 200, description: 'Submission detail' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async getSubmission(@Param('doctorId') doctorId: string) {
    return this.verificationService.getSubmission(doctorId);
  }

  @Patch('documents/:documentId/approve')
  @Roles('backoffice')
  @ApiOperation({ summary: 'Approve a submitted document' })
  @ApiResponse({ status: 200, description: 'Document approved' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async approveDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() user: any,
    @Body() dto: ApproveDocumentDto,
  ) {
    return this.verificationService.approveDocument(documentId, user.userId, dto.note);
  }

  @Patch('documents/:documentId/reject')
  @Roles('backoffice')
  @ApiOperation({ summary: 'Reject a submitted document with a reason' })
  @ApiResponse({ status: 200, description: 'Document rejected' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async rejectDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() user: any,
    @Body() dto: RejectDocumentDto,
  ) {
    return this.verificationService.rejectDocument(documentId, user.userId, dto.rejectionReason);
  }
}
