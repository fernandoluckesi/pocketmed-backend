import { Controller, Get, Put, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
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

  @Get('stats/summary')
  @ApiOperation({ summary: 'Get patients summary for current doctor' })
  @ApiResponse({ status: 200, description: 'Return patients summary' })
  async getSummary(@CurrentUser() user: any) {
    return this.patientsService.getSummary(user.type, user.userId, user.role, user.activeClinicId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get patients accessible by current professional context' })
  @ApiResponse({ status: 200, description: 'Return accessible patients' })
  async findMyPatients(@CurrentUser() user: any) {
    return this.patientsService.findMyPatients(
      user.type,
      user.userId,
      user.role,
      user.activeClinicId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all patients (doctors only)' })
  @ApiResponse({ status: 200, description: 'Return all patients' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only doctors can view all patients' })
  async findAll(@CurrentUser() user: any) {
    return this.patientsService.findAll(user.type, user.userId, user.role, user.activeClinicId);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search patients by name or email (professionals only, min 3 characters)',
  })
  @ApiQuery({ name: 'q', description: 'Search query (minimum 3 characters)' })
  @ApiResponse({ status: 200, description: 'Return matching patients' })
  @ApiResponse({ status: 403, description: 'Forbidden or query too short' })
  async search(@Query('q') query: string, @CurrentUser() user: any) {
    return this.patientsService.search(
      query,
      user.type,
      user.userId,
      user.role,
      user.activeClinicId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID (doctors or own patient)' })
  @ApiResponse({ status: 200, description: 'Return patient' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.findOne(id, user.userId, user.type, user.role, user.activeClinicId);
  }

  // ─── Sprint 1: Patient Sub-resource Endpoints ─────────────────────────────

  @Get(':id/medical-record')
  @ApiOperation({ summary: 'Get full medical record for a patient' })
  @ApiResponse({ status: 200, description: 'Return consolidated medical record' })
  async getMedicalRecord(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getMedicalRecord(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
    );
  }

  @Get(':id/consultations')
  @ApiOperation({ summary: 'Get consultations (appointments) for a patient' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter start date (ISO)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter end date (ISO)' })
  @ApiResponse({ status: 200, description: 'Return patient consultations' })
  async getConsultations(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: any,
  ) {
    return this.patientsService.getConsultations(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
      startDate,
      endDate,
    );
  }

  @Get(':id/medications')
  @ApiOperation({ summary: 'Get medications for a patient' })
  @ApiResponse({ status: 200, description: 'Return patient medications' })
  async getMedications(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getMedications(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
    );
  }

  @Get(':id/exams')
  @ApiOperation({ summary: 'Get exams/documents for a patient' })
  @ApiResponse({ status: 200, description: 'Return patient exams' })
  async getExams(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getExams(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
    );
  }

  @Post(':id/consultations')
  @ApiOperation({ summary: 'Create a consultation note for a patient' })
  @ApiResponse({ status: 201, description: 'Consultation created' })
  async createConsultation(
    @Param('id') id: string,
    @Body() body: { date: string; symptoms?: string; diagnosis?: string; prescription?: string; notes?: string; priority?: string; completed?: boolean },
    @CurrentUser() user: any,
  ) {
    return this.patientsService.createConsultation(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
      body,
    );
  }

  @Put(':id/consultations/:consultationId')
  @ApiOperation({ summary: 'Update a consultation for a patient' })
  @ApiResponse({ status: 200, description: 'Consultation updated' })
  async updateConsultation(
    @Param('id') id: string,
    @Param('consultationId') consultationId: string,
    @Body() body: { date?: string; symptoms?: string; diagnosis?: string; prescription?: string; notes?: string; completed?: boolean },
    @CurrentUser() user: any,
  ) {
    return this.patientsService.updateConsultation(
      id,
      consultationId,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
      body,
    );
  }

  @Post(':id/consultations/:consultationId/approve')
  @ApiOperation({ summary: 'Patient approves or rejects a consultation' })
  @ApiResponse({ status: 200, description: 'Consultation approved/rejected' })
  async approveConsultation(
    @Param('id') id: string,
    @Param('consultationId') consultationId: string,
    @Body() body: { approved: boolean },
    @CurrentUser() user: any,
  ) {
    return this.patientsService.approveConsultation(
      id,
      consultationId,
      user.userId,
      body.approved,
    );
  }

  @Post(':id/consultations/:consultationId/resend')
  @ApiOperation({ summary: 'Doctor resends a rejected consultation for re-approval' })
  @ApiResponse({ status: 200, description: 'Consultation resent' })
  async resendConsultation(
    @Param('id') id: string,
    @Param('consultationId') consultationId: string,
    @CurrentUser() user: any,
  ) {
    return this.patientsService.resendConsultation(
      id,
      consultationId,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
    );
  }

  @Post(':id/medications')
  @ApiOperation({ summary: 'Prescribe medication for a patient' })
  @ApiResponse({ status: 201, description: 'Medication prescribed' })
  async prescribeMedication(
    @Param('id') id: string,
    @Body() body: { name: string; dosage: string; frequency: string; type?: string; startDate: string; endDate?: string; notes?: string },
    @CurrentUser() user: any,
  ) {
    return this.patientsService.prescribeMedication(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
      body,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update patient personal data' })
  @ApiResponse({ status: 200, description: 'Patient updated' })
  async updatePatient(
    @Param('id') id: string,
    @Body() body: { name?: string; phone?: string; gender?: string; birthDate?: string; profileImage?: string },
    @CurrentUser() user: any,
  ) {
    return this.patientsService.updatePatient(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
      body,
    );
  }

  // ─── Sprint 3: Timeline & Alerts ─────────────────────────────────────────

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get patient timeline (all events chronologically)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max items to return (default 50)' })
  @ApiResponse({ status: 200, description: 'Return patient timeline' })
  async getTimeline(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @CurrentUser() user: any,
  ) {
    return this.patientsService.getTimeline(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get(':id/alerts')
  @ApiOperation({ summary: 'Get clinical alerts for a patient' })
  @ApiResponse({ status: 200, description: 'Return patient alerts' })
  async getAlerts(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getAlerts(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
    );
  }

  // ─── Sprint 4: Audit Logging ──────────────────────────────────────────────

  @Get(':id/access-log')
  @ApiOperation({ summary: 'Get access log for a patient (audit trail)' })
  @ApiResponse({ status: 200, description: 'Return access log entries' })
  async getAccessLog(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getAccessLog(
      id,
      user.userId,
      user.type,
      user.role,
      user.activeClinicId,
    );
  }
}
