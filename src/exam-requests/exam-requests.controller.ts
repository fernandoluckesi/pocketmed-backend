import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Redirect,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExamRequestsService } from './exam-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateExamRequestDto } from './dto/create-exam-request.dto';
import { UpdateExamRequestDto } from './dto/update-exam-request.dto';

/**
 * Formal "pedido de exame" documents — distinct from `/exams` (individual
 * exam scheduling/result rows). Route is `exam-requests`, not `exams`, so it
 * never collides with that existing resource, and so the signature-simulator
 * page's per-feature confirm-signature callback resolves unambiguously.
 */
@ApiTags('Exam Requests')
@Controller('exam-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ExamRequestsController {
  constructor(private examRequestsService: ExamRequestsService) {}

  @Post()
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Create an exam request (draft — no PDF yet)' })
  @ApiResponse({ status: 201, description: 'Exam request created successfully' })
  async create(@CurrentUser() user: any, @Body() dto: CreateExamRequestDto) {
    return this.examRequestsService.create(user.userId, dto);
  }

  @Get()
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'List exam requests issued by the current doctor' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiResponse({ status: 200, description: 'Return exam requests' })
  async findAll(@CurrentUser() user: any, @Query('patientId') patientId?: string) {
    return this.examRequestsService.findAll(user.userId, patientId);
  }

  @Get(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Get exam request by ID' })
  @ApiResponse({ status: 200, description: 'Return exam request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Exam request not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.examRequestsService.findOne(id, user.userId);
  }

  @Patch(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Update a draft/generated exam request (issuing doctor only)' })
  @ApiResponse({ status: 200, description: 'Exam request updated successfully' })
  @ApiResponse({ status: 409, description: 'Already signed — immutable' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateExamRequestDto,
  ) {
    return this.examRequestsService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Delete a draft/generated exam request (issuing doctor only)' })
  @ApiResponse({ status: 200, description: 'Exam request deleted successfully' })
  @ApiResponse({ status: 409, description: 'Already signed — cannot be deleted' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.examRequestsService.delete(id, user.userId);
  }

  @Get(':id/preview')
  @Roles('doctor', 'admin')
  @ApiOperation({
    summary: 'Returns the exact document structure the PDF is rendered from (no PDF produced)',
  })
  @ApiResponse({ status: 200, description: 'Document spec for on-screen preview' })
  async preview(@Param('id') id: string, @CurrentUser() user: any) {
    return this.examRequestsService.preview(id, user.userId);
  }

  @Post(':id/generate-pdf')
  @Roles('doctor', 'admin')
  @ApiOperation({
    summary:
      'Generate the exam-request PDF, hash it, pass it through the (currently mock) signature service, and store it',
  })
  @ApiResponse({ status: 201, description: 'PDF generated and stored' })
  async generatePdf(@Param('id') id: string, @CurrentUser() user: any) {
    return this.examRequestsService.generatePdf(id, user.userId);
  }

  @Post(':id/cancel')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Cancel an exam request, keeping it (and its audit trail) on record' })
  @ApiResponse({ status: 201, description: 'Exam request canceled' })
  @ApiResponse({ status: 409, description: 'Already signed or already canceled' })
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.examRequestsService.cancel(id, user.userId);
  }

  @Post(':id/send')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Send the generated PDF to the patient without a digital signature' })
  @ApiResponse({ status: 201, description: 'Exam request sent' })
  @ApiResponse({ status: 409, description: 'No PDF generated yet' })
  async send(@Param('id') id: string, @CurrentUser() user: any) {
    return this.examRequestsService.send(id, user.userId);
  }

  @Post(':id/request-signature')
  @Roles('doctor', 'admin')
  @ApiOperation({
    summary:
      'Start a digital-signature request — returns the URL to open (new tab) for the doctor to sign',
  })
  @ApiResponse({ status: 201, description: 'Signature request created' })
  async requestSignature(@Param('id') id: string, @CurrentUser() user: any) {
    return this.examRequestsService.requestSignature(id, user.userId);
  }

  @Post(':id/confirm-signature')
  @Roles('doctor', 'admin')
  @ApiOperation({
    summary:
      'Called once the signer finishes on the signing page — marks the exam request signed and sends it to the patient',
  })
  @ApiResponse({ status: 201, description: 'Exam request signed and sent' })
  async confirmSignature(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { externalSignatureId: string },
  ) {
    return this.examRequestsService.confirmSignature(id, user.userId, body.externalSignatureId);
  }

  @Get(':id/pdf')
  @Roles('doctor', 'admin')
  @Redirect()
  @ApiOperation({ summary: 'Redirects to the stored PDF for this exam request' })
  @ApiResponse({ status: 302, description: 'Redirect to the document URL' })
  @ApiResponse({ status: 404, description: 'No PDF generated yet' })
  async getPdf(@Param('id') id: string, @CurrentUser() user: any) {
    return { url: await this.examRequestsService.getDocumentUrl(id, user.userId) };
  }
}
