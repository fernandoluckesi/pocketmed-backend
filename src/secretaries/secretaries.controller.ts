import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SecretariesService } from './secretaries.service';
import { CreateSecretaryDto } from './dto/create-secretary.dto';
import { UpdateSecretaryDto } from './dto/update-secretary.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Secretaries')
@Controller('secretaries')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SecretariesController {
  constructor(private readonly secretariesService: SecretariesService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a new secretary for the active clinic' })
  @ApiResponse({ status: 201, description: 'Secretary created and invitation sent' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async create(@CurrentUser() user: any, @Body() dto: CreateSecretaryDto) {
    const clinicId = user.activeClinicId;
    if (!clinicId) {
      return { statusCode: 403, message: 'Active clinic context required' };
    }
    return this.secretariesService.create(dto, clinicId, user.userId);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all secretaries from active clinic' })
  @ApiResponse({ status: 200, description: 'Secretaries list' })
  async findAll(@CurrentUser() user: any) {
    const clinicId = user.activeClinicId;
    if (!clinicId) {
      return [];
    }
    return this.secretariesService.findAllByClinic(clinicId);
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get a single secretary by ID' })
  @ApiResponse({ status: 200, description: 'Secretary details' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.secretariesService.findOne(id, user.activeClinicId);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update secretary info' })
  @ApiResponse({ status: 200, description: 'Secretary updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateSecretaryDto) {
    return this.secretariesService.update(id, user.activeClinicId, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Hard delete a secretary (removes from system completely)' })
  @ApiResponse({ status: 200, description: 'Secretary removed' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    await this.secretariesService.remove(id, user.activeClinicId);
    return { message: 'Secretário(a) removido(a) com sucesso.' };
  }

  @Post(':id/resend-code')
  @Roles('admin')
  @ApiOperation({ summary: 'Resend activation code to a pending secretary' })
  @ApiResponse({ status: 200, description: 'Code resent' })
  @ApiResponse({ status: 400, description: 'Secretary already activated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async resendCode(@CurrentUser() user: any, @Param('id') id: string) {
    return this.secretariesService.resendCode(id, user.activeClinicId);
  }
}
