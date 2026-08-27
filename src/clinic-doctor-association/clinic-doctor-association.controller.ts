import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicDoctorAssociationService } from './clinic-doctor-association.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RespondInviteDto } from './dto/respond-invite.dto';
import { SearchDoctorDto } from './dto/search-doctor.dto';

@ApiTags('Clinic Association')
@Controller('clinic-association')
export class ClinicDoctorAssociationController {
  constructor(private readonly clinicDoctorAssociationService: ClinicDoctorAssociationService) {}

  // === Convites (Admin) ===

  @Post('invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send an invite to a doctor to join the clinic' })
  @ApiResponse({ status: 201, description: 'Invite created successfully' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  @ApiResponse({ status: 409, description: 'Pending invite or active membership already exists' })
  async createInvite(@CurrentUser() user: any, @Body() dto: CreateInviteDto) {
    return this.clinicDoctorAssociationService.createInvite(user, dto);
  }

  @Get('invites/sent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List invites sent by the clinic' })
  @ApiResponse({ status: 200, description: 'List of sent invites' })
  async getSentInvites(@CurrentUser() user: any) {
    return this.clinicDoctorAssociationService.getSentInvites(user.activeClinicId);
  }

  @Patch('invites/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel a pending invite' })
  @ApiResponse({ status: 200, description: 'Invite cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Only pending invites can be cancelled' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  async cancelInvite(@Param('id') id: string, @CurrentUser() user: any) {
    await this.clinicDoctorAssociationService.cancelInvite(user, id);
    return { message: 'Solicitação cancelada com sucesso' };
  }

  // === Convites (Médico) ===

  @Get('invites/received')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List invites received by the doctor' })
  @ApiResponse({ status: 200, description: 'List of received invites' })
  async getReceivedInvites(@CurrentUser() user: any) {
    return this.clinicDoctorAssociationService.getReceivedInvites(user.userId);
  }

  @Patch('invites/:id/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Accept or reject a clinic invite' })
  @ApiResponse({ status: 200, description: 'Invite response processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid decision or invite already responded' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  async respondToInvite(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: RespondInviteDto,
  ) {
    await this.clinicDoctorAssociationService.respondToInvite(user, id, dto);
    return { message: 'Resposta registrada com sucesso' };
  }

  // === Memberships ===

  @Get('memberships/my-clinics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List clinics the doctor is associated with' })
  @ApiResponse({ status: 200, description: 'List of active clinic memberships' })
  async getMyClinics(@CurrentUser() user: any) {
    return this.clinicDoctorAssociationService.getMyClinics(user.userId);
  }

  @Delete('memberships/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Doctor leaves a clinic' })
  @ApiResponse({ status: 200, description: 'Membership deactivated successfully' })
  @ApiResponse({ status: 400, description: 'Membership already inactive' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  async leaveClinic(@Param('id') id: string, @CurrentUser() user: any) {
    await this.clinicDoctorAssociationService.leaveClinic(user, id);
    return { message: 'Associação encerrada com sucesso' };
  }

  @Delete('memberships/:id/remove')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Admin removes a doctor from the clinic' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 400, description: 'Membership already inactive' })
  @ApiResponse({ status: 403, description: 'Access denied - admin role required' })
  @ApiResponse({ status: 404, description: 'Membership not found' })
  @ApiResponse({ status: 422, description: 'Last admin cannot be removed' })
  async removeMember(@Param('id') id: string, @CurrentUser() user: any) {
    await this.clinicDoctorAssociationService.removeMember(user, id);
    return { message: 'Membro removido com sucesso' };
  }

  // === Pesquisa ===

  @Get('doctors/search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Search doctor by CRM number and state' })
  @ApiResponse({ status: 200, description: 'Doctor found' })
  @ApiResponse({ status: 404, description: 'No doctor found with the given CRM' })
  @ApiResponse({ status: 400, description: 'CRM and state are required' })
  async searchDoctor(@Query() dto: SearchDoctorDto) {
    return this.clinicDoctorAssociationService.searchDoctorByCrm(dto.crm, dto.state);
  }

  // === Dashboard ===

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'View clinic dashboard with doctors and patient counts' })
  @ApiResponse({ status: 200, description: 'Dashboard data returned successfully' })
  @ApiResponse({ status: 403, description: 'Access denied - no active membership' })
  @ApiResponse({ status: 500, description: 'Temporary unavailability loading data' })
  async getClinicDashboard(@CurrentUser() user: any) {
    return this.clinicDoctorAssociationService.getClinicDashboard(user.activeClinicId);
  }

  @Get('dashboard/doctors/:doctorId/patients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "View a doctor's patients in the clinic" })
  @ApiResponse({ status: 200, description: 'Patient list returned successfully' })
  @ApiResponse({ status: 403, description: 'Access denied - no active membership' })
  async getDoctorPatients(@Param('doctorId') doctorId: string, @CurrentUser() user: any) {
    return this.clinicDoctorAssociationService.getDoctorPatients(
      user.activeClinicId,
      doctorId,
      user.userId,
    );
  }
}
