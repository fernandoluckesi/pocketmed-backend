import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
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
import { CertificatesService } from './certificates.service';
import { CertificateParserService } from './certificate-parser.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import {
  createFileTypeValidationPipe,
  DOCUMENT_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE,
} from '../common/upload-validation';

@ApiTags('Certificates')
@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class CertificatesController {
  constructor(
    private certificatesService: CertificatesService,
    private certificateParserService: CertificateParserService,
  ) {}

  @Post()
  @Roles('doctor', 'admin', 'patient')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_FILE_SIZE } }))
  @ApiOperation({
    summary:
      'Issue a certificate ("atestado") — by a doctor for a patient/dependent, or self-reported by the patient',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Certificate created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - No permission' })
  @ApiResponse({ status: 404, description: 'Patient or Dependent not found' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateCertificateDto,
    @UploadedFile(
      createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.certificatesService.create(user.userId, user.type, dto, file);
  }

  @Post('parse')
  @Roles('doctor', 'admin', 'patient')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_FILE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Parse an attached certificate (PDF/image) and extract CRM, CID, description, days off and issue date',
  })
  @ApiResponse({ status: 200, description: 'Returns the fields detected in the attachment' })
  async parse(
    @UploadedFile(
      createFileTypeValidationPipe({ allowedMimeTypes: DOCUMENT_MIME_TYPES, fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return this.certificateParserService.parseCertificate(file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all certificates for the current user' })
  @ApiQuery({ name: 'patientId', required: false, description: 'Filter by patient (doctor view)' })
  @ApiResponse({ status: 200, description: 'Return certificates' })
  async findAll(@CurrentUser() user: any, @Query('patientId') patientId?: string) {
    return this.certificatesService.findAll(user.userId, user.type, patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get certificate by ID' })
  @ApiResponse({ status: 200, description: 'Return certificate' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.certificatesService.findOne(id, user.userId, user.type);
  }

  @Put(':id')
  @Roles('doctor', 'admin', 'patient')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_FILE_SIZE } }))
  @ApiOperation({ summary: 'Update a certificate (issuing doctor or owning patient)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Certificate updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCertificateDto,
    @UploadedFile(
      createFileTypeValidationPipe({
        allowedMimeTypes: DOCUMENT_MIME_TYPES,
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.certificatesService.update(id, user.userId, user.type, dto, file);
  }

  @Delete(':id')
  @Roles('doctor', 'admin', 'patient')
  @ApiOperation({ summary: 'Delete a certificate (issuing doctor or owning patient)' })
  @ApiResponse({ status: 200, description: 'Certificate deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.certificatesService.delete(id, user.userId, user.type);
  }
}
