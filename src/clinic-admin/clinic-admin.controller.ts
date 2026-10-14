import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicAdminService } from './clinic-admin.service';
import { AddClinicMemberDto } from './dto/add-clinic-member.dto';
import { CreateShadowDoctorByAdminDto } from './dto/create-shadow-doctor-by-admin.dto';
import { ListClinicMembersQueryDto } from './dto/list-clinic-members.query.dto';
import { UpdateClinicMemberRoleDto } from './dto/update-clinic-member-role.dto';
import { UpdateClinicMemberTransferPercentageDto } from './dto/update-clinic-member-transfer-percentage.dto';
import { UpdateRoleProfileDto } from './dto/update-role-profile.dto';

@ApiTags('Clinic Admin')
@Controller('clinic-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles('admin')
export class ClinicAdminController {
  constructor(private readonly clinicAdminService: ClinicAdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get current clinic overview (admins only)' })
  @ApiResponse({ status: 200, description: 'Clinic overview returned successfully' })
  async getOverview(@CurrentUser() user: any) {
    return this.clinicAdminService.getOverview(user);
  }

  @Get('members')
  @ApiOperation({ summary: 'List active clinic members (admins only)' })
  @ApiResponse({ status: 200, description: 'Clinic members returned successfully' })
  async listMembers(@CurrentUser() user: any, @Query() query: ListClinicMembersQueryDto) {
    return this.clinicAdminService.listMembers(user, query);
  }

  @Patch('members/:membershipId/role')
  @ApiOperation({ summary: 'Update member role in active clinic (admins only)' })
  @ApiResponse({ status: 200, description: 'Member role updated successfully' })
  async updateMemberRole(
    @CurrentUser() user: any,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateClinicMemberRoleDto,
  ) {
    return this.clinicAdminService.updateMemberRole(user, membershipId, dto);
  }

  @Patch('members/:membershipId/transfer-percentage')
  @ApiOperation({
    summary: "Set a doctor's repasse percentage override for the active clinic (admins only)",
  })
  @ApiResponse({ status: 200, description: 'Transfer percentage updated successfully' })
  async updateMemberTransferPercentage(
    @CurrentUser() user: any,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateClinicMemberTransferPercentageDto,
  ) {
    return this.clinicAdminService.updateMemberTransferPercentage(user, membershipId, dto);
  }

  @Post('members')
  @ApiOperation({ summary: 'Add existing professional to active clinic (admins only)' })
  @ApiResponse({ status: 201, description: 'Member added successfully' })
  async addMember(@CurrentUser() user: any, @Body() dto: AddClinicMemberDto) {
    return this.clinicAdminService.addMember(user, dto);
  }

  @Delete('members/:membershipId')
  @ApiOperation({ summary: 'Deactivate clinic member (admins only)' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  async removeMember(@CurrentUser() user: any, @Param('membershipId') membershipId: string) {
    return this.clinicAdminService.removeMember(user, membershipId);
  }

  @Post('doctors/shadow')
  @ApiOperation({ summary: 'Create shadow doctor and add to active clinic (admins only)' })
  @ApiResponse({ status: 201, description: 'Shadow doctor created successfully' })
  async createShadowDoctor(@CurrentUser() user: any, @Body() dto: CreateShadowDoctorByAdminDto) {
    return this.clinicAdminService.createShadowDoctor(user, dto);
  }

  @Get('patients')
  @Roles('admin', 'secretary')
  @ApiOperation({ summary: 'List patients linked to clinic doctors (admins and secretaries)' })
  @ApiResponse({ status: 200, description: 'Clinic patients returned successfully' })
  async listClinicPatients(@CurrentUser() user: any) {
    return this.clinicAdminService.listClinicPatients(user);
  }

  @Get('doctors')
  @Roles('admin', 'secretary')
  @ApiOperation({ summary: 'List doctors from active clinic (admins and secretaries)' })
  @ApiResponse({ status: 200, description: 'Clinic doctors returned successfully' })
  async listClinicDoctors(@CurrentUser() user: any) {
    return this.clinicAdminService.listClinicDoctors(user);
  }

  @Get('doctors/search')
  @ApiOperation({
    summary: 'Search doctors by name/email/cpf and flag clinic membership (admins only)',
  })
  @ApiResponse({ status: 200, description: 'Doctors search returned successfully' })
  async searchDoctors(@CurrentUser() user: any, @Query('q') q: string) {
    return this.clinicAdminService.searchDoctors(user, q);
  }

  @Get('doctors/search/email')
  @ApiOperation({ summary: 'Find doctor by exact email and flag clinic membership (admins only)' })
  @ApiResponse({ status: 200, description: 'Doctor lookup returned successfully' })
  async findDoctorByEmail(@CurrentUser() user: any, @Query('email') email: string) {
    return this.clinicAdminService.findDoctorByEmail(user, email);
  }

  @Get('profiles/admins')
  @ApiOperation({ summary: 'List clinic admin profiles from active clinic (admins only)' })
  @ApiResponse({ status: 200, description: 'Clinic admin profiles returned successfully' })
  async listAdminProfiles(@CurrentUser() user: any) {
    return this.clinicAdminService.listAdminProfiles(user);
  }

  @Get('profiles/admins/:profileId')
  @ApiOperation({ summary: 'Get clinic admin profile by id in active clinic (admins only)' })
  @ApiResponse({ status: 200, description: 'Clinic admin profile returned successfully' })
  async getAdminProfile(@CurrentUser() user: any, @Param('profileId') profileId: string) {
    return this.clinicAdminService.getAdminProfile(user, profileId);
  }

  @Patch('profiles/admins/:profileId')
  @ApiOperation({ summary: 'Update clinic admin profile in active clinic (admins only)' })
  @ApiResponse({ status: 200, description: 'Clinic admin profile updated successfully' })
  async updateAdminProfile(
    @CurrentUser() user: any,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateRoleProfileDto,
  ) {
    return this.clinicAdminService.updateAdminProfile(user, profileId, dto);
  }

  @Delete('profiles/admins/:profileId')
  @ApiOperation({ summary: 'Delete clinic admin profile in active clinic (admins only)' })
  @ApiResponse({ status: 200, description: 'Clinic admin profile deleted successfully' })
  async deleteAdminProfile(@CurrentUser() user: any, @Param('profileId') profileId: string) {
    return this.clinicAdminService.deleteAdminProfile(user, profileId);
  }

  @Get('profiles/secretaries')
  @ApiOperation({ summary: 'List secretary profiles from active clinic (admins only)' })
  @ApiResponse({ status: 200, description: 'Secretary profiles returned successfully' })
  async listSecretaryProfiles(@CurrentUser() user: any) {
    return this.clinicAdminService.listSecretaryProfiles(user);
  }

  @Get('profiles/secretaries/:profileId')
  @ApiOperation({ summary: 'Get secretary profile by id in active clinic (admins only)' })
  @ApiResponse({ status: 200, description: 'Secretary profile returned successfully' })
  async getSecretaryProfile(@CurrentUser() user: any, @Param('profileId') profileId: string) {
    return this.clinicAdminService.getSecretaryProfile(user, profileId);
  }

  @Patch('profiles/secretaries/:profileId')
  @ApiOperation({ summary: 'Update secretary profile in active clinic (admins only)' })
  @ApiResponse({ status: 200, description: 'Secretary profile updated successfully' })
  async updateSecretaryProfile(
    @CurrentUser() user: any,
    @Param('profileId') profileId: string,
    @Body() dto: UpdateRoleProfileDto,
  ) {
    return this.clinicAdminService.updateSecretaryProfile(user, profileId, dto);
  }

  @Delete('profiles/secretaries/:profileId')
  @ApiOperation({ summary: 'Delete secretary profile in active clinic (admins only)' })
  @ApiResponse({ status: 200, description: 'Secretary profile deleted successfully' })
  async deleteSecretaryProfile(@CurrentUser() user: any, @Param('profileId') profileId: string) {
    return this.clinicAdminService.deleteSecretaryProfile(user, profileId);
  }
}
