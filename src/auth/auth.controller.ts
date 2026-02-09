import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register/patient')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({ summary: 'Register a new patient' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Patient registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async registerPatient(
    @Body() dto: RegisterPatientDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.registerPatient(dto, file);
  }

  @Public()
  @Post('register/patient-shadow')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({ summary: 'Register a shadow patient by a doctor' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Shadow patient created successfully' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async registerPatientShadow(
    @Body() dto: RegisterPatientShadowDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.registerPatientShadow(dto, file);
  }

  @Public()
  @Post('register/doctor')
  @UseInterceptors(FileInterceptor('profileImage'))
  @ApiOperation({ summary: 'Register a new doctor' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Doctor registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async registerDoctor(
    @Body() dto: RegisterDoctorDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authService.registerDoctor(dto, file);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset code' })
  @ApiResponse({ status: 200, description: 'Reset code sent to email' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset code' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.resetCode, dto.newPassword);
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
    return this.authService.changePassword(user.userId, dto.oldPassword, dto.newPassword);
  }
}
