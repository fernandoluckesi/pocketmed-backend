import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RespondAppointmentDto } from './dto/respond-appointment.dto';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create appointment (doctors and patients)' })
  @ApiResponse({ status: 201, description: 'Appointment created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - No permission' })
  @ApiResponse({ status: 404, description: 'Patient or Dependent not found' })
  async create(@CurrentUser() user: any, @Body() dto: CreateAppointmentDto) {
    return this.appointmentsService.create(user.userId, user.type, user.role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all appointments for current user' })
  @ApiResponse({ status: 200, description: 'Return appointments' })
  async findAll(@CurrentUser() user: any) {
    return this.appointmentsService.findAll(user.userId, user.type, user.role, user.activeClinicId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  @ApiResponse({ status: 200, description: 'Return appointment' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.appointmentsService.findOne(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
    );
  }

  @Put(':id')
  @Roles('doctor')
  @ApiOperation({ summary: 'Update appointment (doctor who created only)' })
  @ApiResponse({ status: 200, description: 'Appointment updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(id, user.userId, user.type, user.role, dto);
  }

  @Post(':id/respond')
  @Roles('patient')
  @ApiOperation({ summary: 'Respond to appointment (patients only)' })
  @ApiResponse({ status: 200, description: 'Appointment status updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async respondToAppointment(
    @Param('id') id: string,
    @Body() dto: RespondAppointmentDto,
    @CurrentUser() user: any,
  ) {
    return this.appointmentsService.respondToAppointment(id, dto.status, user.userId, user.type);
  }

  @Delete(':id')
  @Roles('doctor')
  @ApiOperation({ summary: 'Delete appointment (doctor who created only)' })
  @ApiResponse({ status: 200, description: 'Appointment deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.appointmentsService.delete(id, user.userId, user.type, user.role);
  }
}
