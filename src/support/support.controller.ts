import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SupportService } from './support.service';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { SendPublicSupportMessageDto } from './dto/send-public-support-message.dto';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('contact')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Send a "Fale Conosco" message to the support inbox (logged in)' })
  @ApiResponse({ status: 201, description: 'Message sent to support' })
  async contact(@CurrentUser() user: any, @Body() dto: SendSupportMessageDto) {
    return this.supportService.sendMessage(user, dto.message);
  }

  @Public()
  @Post('contact/public')
  @ApiOperation({ summary: 'Send a "Fale Conosco" message without logging in' })
  @ApiResponse({ status: 201, description: 'Message sent to support' })
  async contactPublic(@Body() dto: SendPublicSupportMessageDto) {
    return this.supportService.sendPublicMessage(dto);
  }
}
