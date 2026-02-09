import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DoctorsService } from './doctors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestAccessDto } from './dto/request-access.dto';
import { RespondAccessRequestDto } from './dto/respond-access-request.dto';

@ApiTags('Doctors')
@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class DoctorsController {
  constructor(private doctorsService: DoctorsService) {}

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
  @Roles('doctor')
  @ApiOperation({ summary: 'Request access to patient or dependent data (doctors only)' })
  @ApiResponse({ status: 201, description: 'Access request sent' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Patient or Dependent not found' })
  async requestAccess(@CurrentUser() user: any, @Body() dto: RequestAccessDto) {
    return this.doctorsService.requestAccess(user.userId, dto);
  }

  @Get('access-requests/me')
  @Roles('doctor')
  @ApiOperation({ summary: 'Get my access requests (doctors only)' })
  @ApiResponse({ status: 200, description: 'Return access requests' })
  async getMyAccessRequests(@CurrentUser() user: any) {
    return this.doctorsService.getMyAccessRequests(user.userId);
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
}
