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
}
