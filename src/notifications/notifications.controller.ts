import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { UnregisterTokenDto } from './dto/unregister-token.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('device-token')
  @ApiOperation({ summary: 'Register Expo push token for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Token registered' })
  async registerToken(@CurrentUser() user: any, @Body() dto: RegisterDeviceTokenDto) {
    await this.notificationsService.registerToken(user.userId, user.type, dto);
    return { message: 'Token registered' };
  }

  @Delete('device-token')
  @ApiOperation({ summary: 'Unregister Expo push token (e.g. on logout)' })
  @ApiResponse({ status: 200, description: 'Token unregistered' })
  async unregisterToken(@CurrentUser() user: any, @Body() body: UnregisterTokenDto) {
    await this.notificationsService.unregisterToken(user.userId, body.expoPushToken);
    return { message: 'Token unregistered' };
  }

  // ─── In-app notification center ────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get all in-app notifications for the current user' })
  async getMyNotifications(@CurrentUser() user: any) {
    return this.notificationsService.getNotificationsForUser(user.userId);
  }

  @Get('me/unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.getUnreadCountForUser(user.userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  async markAsRead(@CurrentUser() user: any, @Param('id') id: string) {
    await this.notificationsService.markAsRead(id, user.userId);
    return { message: 'Marked as read' };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: any) {
    await this.notificationsService.markAllAsRead(user.userId);
    return { message: 'All marked as read' };
  }
}
