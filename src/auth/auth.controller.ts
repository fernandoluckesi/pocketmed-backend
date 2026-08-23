import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { RegisterPatientShadowDto } from './dto/register-patient-shadow.dto';
import { LoginDto } from './dto/login.dto';
import { SendVerificationCodeDto } from './dto/send-verification-code.dto';
import { ActivateShadowAccountDto } from './dto/activate-shadow-account.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register/patient')
  @UseInterceptors(FileInterceptor('profileImage', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Register a new patient' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Patient registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async registerPatient(
    @Body() dto: RegisterPatientDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    console.log('=== AUTH CONTROLLER - REGISTER PATIENT ===');
    console.log('File received in controller:', file ? 'YES' : 'NO');
    if (file) {
      console.log('File details:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });
    }
    return this.authService.registerPatient(dto, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor', 'admin', 'secretary')
  @Post('register/patient-shadow')
  @UseInterceptors(FileInterceptor('profileImage', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Register a shadow patient by a professional account' })
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({ status: 201, description: 'Shadow patient created successfully' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async registerPatientShadow(
    @CurrentUser() user: any,
    @Body() dto: RegisterPatientShadowDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.registerPatientShadow(dto, file, user);
  }

  @Public()
  @Post('register/doctor')
  @UseInterceptors(FileInterceptor('profileImage', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Register a new doctor' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Doctor registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async registerDoctor(@Body() dto: RegisterDoctorDto, @UploadedFile() file?: Express.Multer.File) {
    return this.authService.registerDoctor(dto, file);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    console.log('[LOGIN] Attempting login for:', dto.email);
    const result = await this.authService.login(dto);
    console.log('[LOGIN] Success for:', dto.email);
    return result;
  }

  @Public()
  @Post('check-shadow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if email belongs to a shadow account and send activation code' })
  @ApiResponse({ status: 200, description: 'Shadow check result' })
  async checkShadowAccount(@Body() dto: SendVerificationCodeDto) {
    return this.authService.checkShadowAccount(dto.email);
  }

  @Public()
  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send verification code to shadow account' })
  @ApiResponse({ status: 200, description: 'Verification code sent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto) {
    return this.authService.sendVerificationCode(dto.email);
  }

  @Public()
  @Post('activate-shadow-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate shadow account with verification code' })
  @ApiResponse({ status: 200, description: 'Account activated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async activateShadowAccount(@Body() dto: ActivateShadowAccountDto) {
    return this.authService.activateShadowAccount(dto.email, dto.verificationCode, dto.password);
  }

  @Public()
  @Post('validate-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate verification code without activating' })
  @ApiResponse({ status: 200, description: 'Code is valid' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async validateCode(@Body() body: { email: string; verificationCode: string }) {
    return this.authService.validateCode(body.email, body.verificationCode);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset code (generic — prefers doctor)' })
  @ApiResponse({ status: 200, description: 'Reset code sent to email' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('doctor/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset code for doctor (web)' })
  @ApiResponse({ status: 200, description: 'Reset code sent to email' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async forgotPasswordDoctor(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPasswordDoctor(dto.email);
  }

  @Public()
  @Post('patient/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset code for patient (mobile)' })
  @ApiResponse({ status: 200, description: 'Reset code sent to email' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async forgotPasswordPatient(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPasswordPatient(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with code (generic — prefers doctor)' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset code' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.resetCode, dto.newPassword);
  }

  @Public()
  @Post('doctor/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with code for doctor (web)' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset code' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async resetPasswordDoctor(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPasswordDoctor(dto.email, dto.resetCode, dto.newPassword);
  }

  @Public()
  @Post('patient/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with code for patient (mobile)' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset code' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async resetPasswordPatient(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPasswordPatient(dto.email, dto.resetCode, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change password (requires authentication)' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid old password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      user.userId,
      user.type,
      dto.oldPassword,
      dto.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('send-email-verification')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send email verification code to current user' })
  @ApiResponse({ status: 200, description: 'Verification code sent' })
  @ApiResponse({ status: 400, description: 'Email already verified' })
  async sendEmailVerification(@CurrentUser() user: any) {
    return this.authService.sendEmailVerification(user.userId, user.type);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Verify email with code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  async verifyEmail(@CurrentUser() user: any, @Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(user.userId, user.type, dto.code);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('profileImage', { storage: memoryStorage() }))
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() body: { name?: string; phone?: string; gender?: string; birthDate?: string; specialty?: string; crm?: string; rqe?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.updateProfile(user.userId, user.type, body, file);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete current user account (LGPD) - requires verification code' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code' })
  async deleteAccount(@CurrentUser() user: any, @Body() body: { verificationCode: string }) {
    return this.authService.deleteAccount(user.userId, user.type, body.verificationCode);
  }

  @Post('request-account-deletion')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Request account deletion verification code' })
  @ApiResponse({ status: 200, description: 'Verification code sent to email' })
  async requestAccountDeletion(@CurrentUser() user: any) {
    return this.authService.requestAccountDeletion(user.userId, user.type);
  }
}
