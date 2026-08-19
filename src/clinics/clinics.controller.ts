import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';

@ApiTags('Clinics')
@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Public()
  @Post()
  @UseInterceptors(FileInterceptor('profileImage', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Register a new clinic with its admin doctor (public)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Clinic and admin created successfully' })
  @ApiResponse({ status: 409, description: 'Email, phone, CRM or CNPJ already registered' })
  async create(@Body() dto: CreateClinicDto, @UploadedFile() file?: Express.Multer.File) {
    return this.clinicsService.create(dto, file);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor', 'admin', 'secretary')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List clinics the authenticated professional belongs to' })
  @ApiResponse({ status: 200, description: 'Clinics listed successfully' })
  async findMyClinics(@CurrentUser() user: any) {
    return this.clinicsService.findMyClinic(user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor', 'admin', 'secretary')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a specific clinic by ID (must be a member)' })
  @ApiResponse({ status: 200, description: 'Clinic returned successfully' })
  @ApiResponse({ status: 404, description: 'Clinic not found or not a member' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clinicsService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update clinic data (admin only)' })
  @ApiResponse({ status: 200, description: 'Clinic updated successfully' })
  @ApiResponse({ status: 403, description: 'Only admins can update' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.update(id, dto, user);
  }
}
