import { Controller, Get, Put, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
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
    @Body() body: { name: string; dosage: string; frequency: string; type?: string; startDate: string; endDate?: string; notes?: string; appointmentId?: string },
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
    @Body() body: { name?: string; email?: string; phone?: string; gender?: string; birthDate?: string; profileImage?: string },
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

  @Get(':id/diseases')
  @ApiOperation({ summary: 'Get patient diseases list' })
  @ApiResponse({ status: 200, description: 'Diseases list' })
  async getDiseases(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getDiseases(id, user.userId, user.type, user.role, user.activeClinicId);
  }

  @Post(':id/diseases')
  @ApiOperation({ summary: 'Add a disease to patient' })
  @ApiResponse({ status: 201, description: 'Disease created' })
  async createDisease(
    @Param('id') id: string,
    @Body() body: { name: string; description?: string; status?: string; diagnosisDate?: string; treatmentStartDate?: string; treatmentEndDate?: string },
    @CurrentUser() user: any,
  ) {
    return this.patientsService.createDisease(id, user.userId, user.type, user.role, user.activeClinicId, body);
  }

  @Put(':id/diseases/:diseaseId')
  @ApiOperation({ summary: 'Update a patient disease' })
  @ApiResponse({ status: 200, description: 'Disease updated' })
  async updateDisease(
    @Param('id') id: string,
    @Param('diseaseId') diseaseId: string,
    @Body() body: { name?: string; description?: string; status?: string; diagnosisDate?: string; treatmentStartDate?: string; treatmentEndDate?: string },
    @CurrentUser() user: any,
  ) {
    return this.patientsService.updateDisease(id, diseaseId, user.userId, user.type, user.role, user.activeClinicId, body);
  }

  @Delete(':id/diseases/:diseaseId')
  @ApiOperation({ summary: 'Delete a patient disease' })
  @ApiResponse({ status: 200, description: 'Disease deleted' })
  async deleteDisease(
    @Param('id') id: string,
    @Param('diseaseId') diseaseId: string,
    @CurrentUser() user: any,
  ) {
    return this.patientsService.deleteDisease(id, diseaseId, user.userId, user.type, user.role, user.activeClinicId);
  }

  // ─── Allergies ────────────────────────────────────────────────────────────

  @Get(':id/allergies')
  @ApiOperation({ summary: 'Get patient allergies' })
  async getAllergies(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getAllergies(id, user.userId, user.type, user.role, user.activeClinicId);
  }

  @Post(':id/allergies')
  @ApiOperation({ summary: 'Add allergy to patient' })
  async createAllergy(@Param('id') id: string, @Body() body: { name: string; severity?: string; reaction?: string; notes?: string }, @CurrentUser() user: any) {
    return this.patientsService.createAllergy(id, user.userId, user.type, user.role, user.activeClinicId, body);
  }

  @Put(':id/allergies/:allergyId')
  @ApiOperation({ summary: 'Update patient allergy' })
  async updateAllergy(@Param('id') id: string, @Param('allergyId') allergyId: string, @Body() body: { name?: string; severity?: string; reaction?: string; notes?: string }, @CurrentUser() user: any) {
    return this.patientsService.updateAllergy(id, allergyId, user.userId, user.type, user.role, user.activeClinicId, body);
  }

  @Delete(':id/allergies/:allergyId')
  @ApiOperation({ summary: 'Delete patient allergy' })
  async deleteAllergy(@Param('id') id: string, @Param('allergyId') allergyId: string, @CurrentUser() user: any) {
    return this.patientsService.deleteAllergy(id, allergyId, user.userId, user.type, user.role, user.activeClinicId);
  }

  // ─── Vaccines ─────────────────────────────────────────────────────────────

  @Get(':id/vaccines')
  @ApiOperation({ summary: 'Get patient vaccines' })
  async getVaccines(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getVaccines(id, user.userId, user.type, user.role, user.activeClinicId);
  }

  @Post(':id/vaccines')
  @ApiOperation({ summary: 'Add vaccine to patient' })
  async createVaccine(@Param('id') id: string, @Body() body: { name: string; dose?: string; applicationDate?: string; nextDoseDate?: string; laboratory?: string; notes?: string }, @CurrentUser() user: any) {
    return this.patientsService.createVaccine(id, user.userId, user.type, user.role, user.activeClinicId, body);
  }

  @Put(':id/vaccines/:vaccineId')
  @ApiOperation({ summary: 'Update patient vaccine' })
  async updateVaccine(@Param('id') id: string, @Param('vaccineId') vaccineId: string, @Body() body: { name?: string; dose?: string; applicationDate?: string; nextDoseDate?: string; laboratory?: string; notes?: string }, @CurrentUser() user: any) {
    return this.patientsService.updateVaccine(id, vaccineId, user.userId, user.type, user.role, user.activeClinicId, body);
  }

  @Delete(':id/vaccines/:vaccineId')
  @ApiOperation({ summary: 'Delete patient vaccine' })
  async deleteVaccine(@Param('id') id: string, @Param('vaccineId') vaccineId: string, @CurrentUser() user: any) {
    return this.patientsService.deleteVaccine(id, vaccineId, user.userId, user.type, user.role, user.activeClinicId);
  }

  // ─── Dependents ─────────────────────────────────────────────────────────────

  @Get(':id/dependents')
  @ApiOperation({ summary: 'Get dependents for a patient' })
  @ApiResponse({ status: 200, description: 'Return dependents list' })
  async getDependents(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.getDependents(id, user.userId, user.type, user.role, user.activeClinicId);
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
