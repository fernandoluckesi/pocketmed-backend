import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MedicationsService } from './medications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

@ApiTags('Medications')
@Controller('medications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class MedicationsController {
  constructor(private medicationsService: MedicationsService) {}

  @Post()
  @Roles('doctor')
  @ApiOperation({ summary: 'Create medication (doctors only)' })
  @ApiResponse({ status: 201, description: 'Medication created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - No permission' })
  @ApiResponse({ status: 404, description: 'Patient or Dependent not found' })
  async create(@CurrentUser() user: any, @Body() dto: CreateMedicationDto) {
    return this.medicationsService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all medications for current user' })
  @ApiResponse({ status: 200, description: 'Return medications' })
  async findAll(@CurrentUser() user: any) {
    return this.medicationsService.findAll(user.userId, user.type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medication by ID' })
  @ApiResponse({ status: 200, description: 'Return medication' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Medication not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.medicationsService.findOne(id, user.userId, user.type);
  }

  @Put(':id')
  @Roles('doctor')
  @ApiOperation({ summary: 'Update medication (doctor who created only)' })
  @ApiResponse({ status: 200, description: 'Medication updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Medication not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateMedicationDto,
  ) {
    return this.medicationsService.update(id, user.userId, user.type, dto);
  }

  @Delete(':id')
  @Roles('doctor')
  @ApiOperation({ summary: 'Delete medication (doctor who created only)' })
  @ApiResponse({ status: 200, description: 'Medication deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Medication not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.medicationsService.delete(id, user.userId, user.type);
  }
}
