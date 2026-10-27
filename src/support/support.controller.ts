import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupportService } from './support.service';
import { SendSupportMessageDto } from './dto/send-support-message.dto';

@ApiTags('Support')
@Controller('support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('contact')
  @ApiOperation({ summary: 'Send a "Fale Conosco" message to the support inbox' })
  @ApiResponse({ status: 201, description: 'Message sent to support' })
  async contact(@CurrentUser() user: any, @Body() dto: SendSupportMessageDto) {
    return this.supportService.sendMessage(user, dto.message);
  }
}
