import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MedicationCatalogService } from './medication-catalog.service';
import { ListMedicationCatalogQueryDto } from './dto/list-medication-catalog.query.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Medication Catalog')
@Controller('medication-catalog')
export class MedicationCatalogController {
  constructor(private readonly medicationCatalogService: MedicationCatalogService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Search the ANVISA medication catalog by product name or substance' })
  @ApiResponse({ status: 200, description: 'Returns matching medications' })
  async findAll(@Query() query: ListMedicationCatalogQueryDto) {
    return this.medicationCatalogService.findAll(query);
  }
}
