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
import { ConvertToClinicDto } from './dto/convert-to-clinic.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

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

  @Post('convert')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor', 'admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Convert the authenticated doctor account into owning a new clinic',
  })
  @ApiResponse({ status: 201, description: 'Clinic created and doctor set as admin' })
  @ApiResponse({ status: 409, description: 'CNPJ already registered' })
  async convertToClinic(@CurrentUser() user: any, @Body() dto: ConvertToClinicDto) {
    return this.clinicsService.convertToClinic(user, dto);
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

  @Get(':id/subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor', 'admin', 'secretary')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get the clinic plan and current usage vs. its limits' })
  @ApiResponse({ status: 200, description: 'Subscription returned successfully' })
  async getSubscription(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clinicsService.getSubscription(id, user);
  }

  @Patch(':id/subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change the clinic plan and/or add-on seats (admin only)' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  async updateSubscription(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.clinicsService.updateSubscription(id, dto, user);
  }

  @Post(':id/subscription/checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Start a checkout (Mercado Pago or Stripe) to subscribe/change plan (admin only)',
  })
  @ApiResponse({ status: 201, description: 'Checkout URL returned' })
  @ApiResponse({ status: 503, description: 'Payment gateway not configured yet' })
  async createCheckoutSession(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.clinicsService.createCheckoutSession(id, dto, user);
  }

  @Post(':id/subscription/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Re-fetch subscription status directly from the gateway (admin only)',
  })
  @ApiResponse({ status: 201, description: 'Subscription returned' })
  async syncSubscription(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clinicsService.syncSubscription(id, user);
  }

  @Post(':id/subscription/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cancel the clinic subscription (admin only)' })
  @ApiResponse({ status: 201, description: 'Subscription cancelled' })
  async cancelSubscription(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clinicsService.cancelSubscription(id, user);
  }

  @Post(':id/subscription/portal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Open the Stripe billing portal for this clinic (admin only)' })
  @ApiResponse({ status: 201, description: 'Billing portal URL returned' })
  @ApiResponse({ status: 503, description: 'Payment gateway not configured yet' })
  async createBillingPortalSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clinicsService.createBillingPortalSession(id, user);
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
