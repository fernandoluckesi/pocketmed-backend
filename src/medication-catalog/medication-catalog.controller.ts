import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { MedicationCatalogService } from './medication-catalog.service';
import { MedicationOrderParserService } from './medication-order-parser.service';
import { ListMedicationCatalogQueryDto } from './dto/list-medication-catalog.query.dto';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  createFileTypeValidationPipe,
  DOCUMENT_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE,
} from '../common/upload-validation';

@ApiTags('Medication Catalog')
@Controller('medication-catalog')
export class MedicationCatalogController {
  constructor(
    private readonly medicationCatalogService: MedicationCatalogService,
    private readonly medicationOrderParserService: MedicationOrderParserService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Search the ANVISA medication catalog by product name or substance' })
  @ApiResponse({ status: 200, description: 'Returns matching medications' })
  async findAll(@Query() query: ListMedicationCatalogQueryDto) {
    return this.medicationCatalogService.findAll(query);
  }

  @Post('parse-order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_FILE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Parse a prescription file (PDF/image) and match medications from the catalog',
  })
  @ApiResponse({ status: 200, description: 'Returns medications matched from the prescription' })
  async parseOrder(
    @UploadedFile(
      createFileTypeValidationPipe({ allowedMimeTypes: DOCUMENT_MIME_TYPES, fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return this.medicationOrderParserService.parseOrder(file);
  }
}
