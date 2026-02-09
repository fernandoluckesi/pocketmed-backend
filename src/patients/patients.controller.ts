import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all patients (doctors only)' })
  @ApiResponse({ status: 200, description: 'Return all patients' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only doctors can view all patients' })
  async findAll(@CurrentUser() user: any) {
    return this.patientsService.findAll(user.type);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search patients by name or email (doctors only, min 3 characters)' })
  @ApiQuery({ name: 'q', description: 'Search query (minimum 3 characters)' })
  @ApiResponse({ status: 200, description: 'Return matching patients' })
  @ApiResponse({ status: 403, description: 'Forbidden or query too short' })
  async search(@Query('q') query: string, @CurrentUser() user: any) {
    return this.patientsService.search(query, user.type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID (doctors or own patient)' })
  @ApiResponse({ status: 200, description: 'Return patient' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.findOne(id, user.userId, user.type);
  }
}
