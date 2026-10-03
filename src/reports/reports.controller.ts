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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Redirect,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { DocumentStatus } from '../documents/document.types';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/tiff',
  'image/heic',
  'image/webp',
];

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post()
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Create a report ("laudo") — draft, no PDF yet' })
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  async create(@CurrentUser() user: any, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.userId, dto);
  }

  @Get()
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'List reports issued by the current doctor' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: DocumentStatus })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Busca por nome do paciente' })
  @ApiResponse({ status: 200, description: 'Return reports' })
  async findAll(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('status') status?: DocumentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.reportsService.findAll(user.userId, {
      patientId,
      status,
      startDate,
      endDate,
      search,
    });
  }

  @Get(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Get report by ID' })
  @ApiResponse({ status: 200, description: 'Return report' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.findOne(id, user.userId);
  }

  @Patch(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Update a draft/generated report (issuing doctor only)' })
  @ApiResponse({ status: 200, description: 'Report updated successfully' })
  @ApiResponse({ status: 409, description: 'Already signed — immutable' })
  async update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateReportDto) {
    return this.reportsService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Delete a draft/generated report (issuing doctor only)' })
  @ApiResponse({ status: 200, description: 'Report deleted successfully' })
  @ApiResponse({ status: 409, description: 'Already signed — cannot be deleted' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.delete(id, user.userId);
  }

  @Get(':id/preview')
  @Roles('doctor', 'admin')
  @ApiOperation({
    summary: 'Returns the exact document structure the PDF is rendered from (no PDF produced)',
  })
  @ApiResponse({ status: 200, description: 'Document spec for on-screen preview' })
  async preview(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.preview(id, user.userId);
  }

  @Post(':id/generate-pdf')
  @Roles('doctor', 'admin')
  @ApiOperation({
    summary:
      'Generate the report PDF, hash it, pass it through the (currently mock) signature service, and store it',
  })
  @ApiResponse({ status: 201, description: 'PDF generated and stored' })
  async generatePdf(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.generatePdf(id, user.userId);
  }

  @Post(':id/file')
  @Roles('doctor', 'admin')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Attach a pre-existing laudo document (PDF/image) issued outside Hispora to this report',
  })
  @ApiResponse({ status: 201, description: 'Attachment stored' })
  @ApiResponse({ status: 400, description: 'Missing or unsupported file' })
  @ApiResponse({ status: 409, description: 'Already signed — immutable' })
  async attachFile(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato não suportado. Aceitos: PDF, JPEG, JPG, PNG, GIF, TIFF, HEIC, WEBP.',
      );
    }
    return this.reportsService.attachFile(id, user.userId, file);
  }

  @Delete(':id/file')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Remove the attached document, keeping the report itself' })
  @ApiResponse({ status: 200, description: 'Attachment removed' })
  @ApiResponse({ status: 404, description: 'Report has no attachment' })
  async removeFile(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.removeFile(id, user.userId);
  }

  @Post(':id/cancel')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Cancel a report, keeping it (and its audit trail) on record' })
  @ApiResponse({ status: 201, description: 'Report canceled' })
  @ApiResponse({ status: 409, description: 'Already signed or already canceled' })
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.cancel(id, user.userId);
  }

  @Get(':id/pdf')
  @Roles('doctor', 'admin')
  @Redirect()
  @ApiOperation({ summary: 'Redirects to the stored PDF for this report' })
  @ApiResponse({ status: 302, description: 'Redirect to the document URL' })
  @ApiResponse({ status: 404, description: 'No PDF generated yet' })
  async getPdf(@Param('id') id: string, @CurrentUser() user: any) {
    return { url: await this.reportsService.getDocumentUrl(id, user.userId) };
  }
}
