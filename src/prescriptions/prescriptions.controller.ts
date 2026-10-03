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
import { PrescriptionsService } from './prescriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

@ApiTags('Prescriptions')
@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PrescriptionsController {
  constructor(private prescriptionsService: PrescriptionsService) {}

  @Post()
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Create a prescription (draft — no PDF yet)' })
  @ApiResponse({ status: 201, description: 'Prescription created successfully' })
  async create(@CurrentUser() user: any, @Body() dto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(user.userId, dto);
  }

  @Get()
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'List prescriptions issued by the current doctor' })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiResponse({ status: 200, description: 'Return prescriptions' })
  async findAll(@CurrentUser() user: any, @Query('patientId') patientId?: string) {
    return this.prescriptionsService.findAll(user.userId, patientId);
  }

  @Get(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Get prescription by ID' })
  @ApiResponse({ status: 200, description: 'Return prescription' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Prescription not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.findOne(id, user.userId);
  }

  @Patch(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Update a draft/generated prescription (issuing doctor only)' })
  @ApiResponse({ status: 200, description: 'Prescription updated successfully' })
  @ApiResponse({ status: 409, description: 'Already signed — immutable' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdatePrescriptionDto,
  ) {
    return this.prescriptionsService.update(id, user.userId, dto);
  }

  @Delete(':id')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Delete a draft/generated prescription (issuing doctor only)' })
  @ApiResponse({ status: 200, description: 'Prescription deleted successfully' })
  @ApiResponse({ status: 409, description: 'Already signed — cannot be deleted' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.delete(id, user.userId);
  }

  @Get(':id/preview')
  @Roles('doctor', 'admin')
  @ApiOperation({
    summary: 'Returns the exact document structure the PDF is rendered from (no PDF produced)',
  })
  @ApiResponse({ status: 200, description: 'Document spec for on-screen preview' })
  async preview(@Param('id') id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.preview(id, user.userId);
  }

  @Post(':id/generate-pdf')
  @Roles('doctor', 'admin')
  @ApiOperation({
    summary:
      'Generate the prescription PDF, hash it, pass it through the (currently mock) signature service, and store it',
  })
  @ApiResponse({ status: 201, description: 'PDF generated and stored' })
  async generatePdf(@Param('id') id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.generatePdf(id, user.userId);
  }

  @Post(':id/cancel')
  @Roles('doctor', 'admin')
  @ApiOperation({ summary: 'Cancel a prescription, keeping it (and its audit trail) on record' })
  @ApiResponse({ status: 201, description: 'Prescription canceled' })
  @ApiResponse({ status: 409, description: 'Already signed or already canceled' })
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.prescriptionsService.cancel(id, user.userId);
  }

  @Get(':id/pdf')
  @Roles('doctor', 'admin')
  @Redirect()
  @ApiOperation({ summary: 'Redirects to the stored PDF for this prescription' })
  @ApiResponse({ status: 302, description: 'Redirect to the document URL' })
  @ApiResponse({ status: 404, description: 'No PDF generated yet' })
  async getPdf(@Param('id') id: string, @CurrentUser() user: any) {
    return { url: await this.prescriptionsService.getDocumentUrl(id, user.userId) };
  }
}
