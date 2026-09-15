import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BackofficeAuthService } from './backoffice-auth.service';
import { BackofficeLoginDto } from './dto/backoffice-login.dto';

/**
 * Authentication for internal Hispora staff.
 *
 * There is intentionally NO public sign-up endpoint: back office accounts are
 * provisioned internally (see scripts/seed), since they grant platform-wide
 * access to professional data.
 */
@ApiTags('Backoffice - Auth')
@Controller('backoffice/auth')
export class BackofficeAuthController {
  constructor(private readonly backofficeAuthService: BackofficeAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Back office staff login' })
  @ApiResponse({ status: 200, description: 'Authenticated' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: BackofficeLoginDto) {
    return this.backofficeAuthService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles('backoffice')
  @ApiOperation({ summary: 'Current back office user profile' })
  @ApiResponse({ status: 200, description: 'Profile' })
  async me(@CurrentUser() user: any) {
    return this.backofficeAuthService.getProfile(user.userId);
  }
}
