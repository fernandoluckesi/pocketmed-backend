import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PLANS } from './plans.config';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'List the 5 fixed Hispora subscription plans' })
  @ApiResponse({ status: 200, description: 'Returns all plans' })
  findAll() {
    return PLANS;
  }
}
