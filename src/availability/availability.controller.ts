import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AvailabilityService } from './availability.service';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';

@ApiTags('Availability')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles('doctor')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('availabilityRules')
  @ApiOperation({ summary: 'Get availability rules for current doctor' })
  @ApiResponse({ status: 200, description: 'Return doctor availability rules' })
  async getRules(@CurrentUser() user: any) {
    return this.availabilityService.getRules(user.userId);
  }

  @Put('availabilityRules/:id')
  @ApiOperation({ summary: 'Update availability rule for current doctor' })
  @ApiResponse({ status: 200, description: 'Rule updated successfully' })
  async updateRule(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateAvailabilityRuleDto,
  ) {
    return this.availabilityService.updateRule(id, user.userId, dto);
  }

  @Get('availabilityExceptions')
  @ApiOperation({ summary: 'Get availability exceptions for current doctor' })
  @ApiResponse({ status: 200, description: 'Return doctor availability exceptions' })
  async getExceptions(@CurrentUser() user: any) {
    return this.availabilityService.getExceptions(user.userId);
  }

  @Post('availabilityExceptions')
  @ApiOperation({ summary: 'Create availability exception for current doctor' })
  @ApiResponse({ status: 201, description: 'Exception created successfully' })
  async createException(@CurrentUser() user: any, @Body() dto: CreateAvailabilityExceptionDto) {
    return this.availabilityService.createException(user.userId, dto);
  }

  @Delete('availabilityExceptions/:id')
  @ApiOperation({ summary: 'Delete availability exception for current doctor' })
  @ApiResponse({ status: 200, description: 'Exception deleted successfully' })
  async deleteException(@Param('id') id: string, @CurrentUser() user: any) {
    return this.availabilityService.removeException(id, user.userId);
  }
}
