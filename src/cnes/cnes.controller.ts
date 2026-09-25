import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CnesService } from './cnes.service';

@ApiTags('CNES')
@Controller('cnes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class CnesController {
  constructor(private readonly cnesService: CnesService) {}

  @Get('search')
  @Roles('patient', 'doctor', 'admin', 'secretary')
  @ApiOperation({
    summary:
      'Search real health establishments (CNES/government open data) by name within a município — used to autofill the clinic address when creating an appointment',
  })
  @ApiResponse({ status: 200, description: 'Matching establishments returned (possibly empty)' })
  async search(
    @Query('nome') nome?: string,
    @Query('uf') uf?: string,
    @Query('cidade') cidade?: string,
  ) {
    if (!nome || nome.trim().length < 3 || !uf?.trim() || !cidade?.trim()) {
      return [];
    }
    return this.cnesService.search(nome.trim(), uf.trim(), cidade.trim());
  }
}
