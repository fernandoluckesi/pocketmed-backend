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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';

@ApiTags('Certificates')
@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class CertificatesController {
  constructor(private certificatesService: CertificatesService) {}

  @Post()
  @Roles('doctor', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Issue a certificate ("atestado") for a patient/dependent' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Certificate created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - No permission' })
  @ApiResponse({ status: 404, description: 'Patient or Dependent not found' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateCertificateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.certificatesService.create(user.userId, dto, file);
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
  @Roles('doctor', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Update a certificate (issuing doctor only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Certificate updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCertificateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.certificatesService.update(id, user.userId, user.type, dto, file);
  }

  @Delete(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Delete a certificate (issuing doctor only)' })
  @ApiResponse({ status: 200, description: 'Certificate deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Certificate not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.certificatesService.delete(id, user.userId, user.type);
  }
}
