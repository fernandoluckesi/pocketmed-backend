import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { DoctorsService } from './doctors.service';
import { CrossClinicAccessService } from './cross-clinic-access.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireDoctorVerified } from '../auth/decorators/require-doctor-verified.decorator';
import { RequestAccessDto } from './dto/request-access.dto';
import { RespondAccessRequestDto } from './dto/respond-access-request.dto';
import { LookupPatientByEmailDto } from './dto/lookup-patient-by-email.dto';
import { RequestCrossClinicAccessDto } from './dto/request-cross-clinic-access.dto';
import { THROTTLE_AUTH, THROTTLE_EMAIL } from '../common/throttler.config';

@ApiTags('Doctors')
@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class DoctorsController {
  constructor(
    private doctorsService: DoctorsService,
    private crossClinicAccessService: CrossClinicAccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all doctors' })
  @ApiResponse({ status: 200, description: 'Return all doctors' })
  async findAll() {
    return this.doctorsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get doctor by ID' })
  @ApiResponse({ status: 200, description: 'Return doctor' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(id);
  }

  @Post('request-access')
  @Roles('doctor', 'admin')
  @RequireDoctorVerified()
  @ApiOperation({ summary: 'Request access to patient or dependent data (doctors and admins)' })
  @ApiResponse({ status: 201, description: 'Access request sent' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Patient or Dependent not found' })
  async requestAccess(@CurrentUser() user: any, @Body() dto: RequestAccessDto) {
    return this.doctorsService.requestAccess(user.userId, dto);
  }

  @Post('patients/lookup-by-email')
  @Roles('doctor', 'admin')
  @RequireDoctorVerified()
  @UseGuards(ThrottlerGuard)
  @Throttle({ [THROTTLE_AUTH]: { ttl: 60_000, limit: 10 } })
  @SkipThrottle({ [THROTTLE_EMAIL]: true })
  @ApiOperation({
    summary:
      'Look up a patient by email for the cross-clinic authorization flow (reveals only found/name, never clinical data)',
  })
  @ApiResponse({ status: 200, description: 'Lookup result' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async lookupPatientByEmail(@CurrentUser() user: any, @Body() dto: LookupPatientByEmailDto) {
    return this.crossClinicAccessService.lookupByEmail(user.userId, dto.email);
  }

  @Post('patients/:patientId/request-cross-clinic-access')
  @Roles('doctor', 'admin')
  @RequireDoctorVerified()
  @UseGuards(ThrottlerGuard)
  @Throttle({ [THROTTLE_AUTH]: { ttl: 60_000, limit: 10 } })
  @SkipThrottle({ [THROTTLE_EMAIL]: true })
  @ApiOperation({
    summary:
      'Request authorization to access a patient record owned by another clinic (in-app if the patient has an account, emailed single-use link otherwise)',
  })
  @ApiResponse({ status: 201, description: 'Request created' })
  @ApiResponse({ status: 400, description: 'Already has access, or a pending request exists' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async requestCrossClinicAccess(
    @CurrentUser() user: any,
    @Param('patientId') patientId: string,
    @Body() dto: RequestCrossClinicAccessDto,
  ) {
    return this.crossClinicAccessService.requestCrossClinicAccess(
      user.userId,
      user.activeClinicId,
      patientId,
      dto.purpose,
    );
  }

  @Post('access-requests/:id/resend-cross-clinic-link')
  @Roles('doctor', 'admin')
  @RequireDoctorVerified()
  @UseGuards(ThrottlerGuard)
  @Throttle({ [THROTTLE_AUTH]: { ttl: 60_000, limit: 10 } })
  @SkipThrottle({ [THROTTLE_EMAIL]: true })
  @ApiOperation({
    summary:
      'Resend the cross-clinic authorization e-mail for a still-pending request (rotates the token)',
  })
  @ApiResponse({ status: 200, description: 'Resend attempted; returns the resulting status' })
  @ApiResponse({ status: 400, description: 'Not an email-link request, or no longer pending' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resendCrossClinicLink(@CurrentUser() user: any, @Param('id') id: string) {
    return this.crossClinicAccessService.resendConsentLink(user.userId, id);
  }

  @Get('access-requests/me')
  @Roles('doctor', 'admin')
  @RequireDoctorVerified()
  @ApiOperation({ summary: 'Get my access requests' })
  @ApiResponse({ status: 200, description: 'Return access requests' })
  async getMyAccessRequests(@CurrentUser() user: any) {
    return this.doctorsService.getMyAccessRequests(user.userId);
  }

  @Delete('access-requests/:id')
  @Roles('doctor', 'admin')
  @RequireDoctorVerified()
  @ApiOperation({ summary: 'Cancel my own pending access request' })
  @ApiResponse({ status: 200, description: 'Access request cancelled' })
  @ApiResponse({ status: 400, description: 'Only pending requests can be cancelled' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Access request not found' })
  async cancelAccessRequest(@Param('id') id: string, @CurrentUser() user: any) {
    return this.doctorsService.cancelAccessRequest(id, user.userId);
  }

  @Post('access-requests/:id/respond')
  @Roles('patient')
  @ApiOperation({ summary: 'Respond to access request (patients only)' })
  @ApiResponse({ status: 200, description: 'Access request updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Access request not found' })
  async respondToAccessRequest(
    @Param('id') id: string,
    @Body() dto: RespondAccessRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.doctorsService.respondToAccessRequest(id, dto.status, user.userId, user.type);
  }

  @Get('access-requests/patient/me')
  @Roles('patient')
  @ApiOperation({ summary: 'Get access requests for my patient profile' })
  @ApiResponse({ status: 200, description: 'Return access requests' })
  async getAccessRequestsForPatient(@CurrentUser() user: any) {
    return this.doctorsService.getAccessRequestsForPatient(user.userId);
  }

  @Get('access-requests/dependents/me')
  @Roles('patient')
  @ApiOperation({ summary: 'Get access requests for my dependents' })
  @ApiResponse({ status: 200, description: 'Return access requests' })
  async getAccessRequestsForDependents(@CurrentUser() user: any) {
    return this.doctorsService.getAccessRequestsForDependents(user.userId);
  }

  @Get('permissions/patient/me')
  @Roles('patient')
  @ApiOperation({ summary: 'Get active doctor permissions for my patient profile' })
  @ApiResponse({ status: 200, description: 'Return active permissions' })
  async getMyPermissions(@CurrentUser() user: any) {
    return this.doctorsService.getPermissionsForPatient(user.userId);
  }

  @Patch('permissions/:id/revoke')
  @Roles('patient')
  @ApiOperation({ summary: 'Revoke a doctor permission (patients only)' })
  @ApiResponse({ status: 200, description: 'Permission revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  async revokePermission(@Param('id') id: string, @CurrentUser() user: any) {
    return this.doctorsService.revokePermission(id, user.userId, user.type);
  }

  @Get('search/crm')
  @ApiOperation({ summary: 'Search doctor by CRM and state' })
  @ApiResponse({ status: 200, description: 'Doctor found' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async searchByCRM(@Query('crm') crm: string, @Query('state') state: string) {
    return this.doctorsService.findByCrm(crm, state);
  }

  @Get('search/name')
  @ApiOperation({ summary: 'Search doctors by name or CRM (cross-clinic)' })
  @ApiResponse({ status: 200, description: 'Return matching doctors' })
  async searchByName(@Query('q') q: string) {
    return this.doctorsService.searchByName(q);
  }
}
