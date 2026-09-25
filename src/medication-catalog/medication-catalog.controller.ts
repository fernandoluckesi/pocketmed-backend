import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { MedicationCatalogService } from './medication-catalog.service';
import { MedicationOrderParserService } from './medication-order-parser.service';
import { ListMedicationCatalogQueryDto } from './dto/list-medication-catalog.query.dto';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/tiff',
  'image/heic',
  'image/webp',
];

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
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Parse a prescription file (PDF/image) and match medications from the catalog',
  })
  @ApiResponse({ status: 200, description: 'Returns medications matched from the prescription' })
  async parseOrder(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato não suportado. Aceitos: PDF, JPEG, JPG, PNG, GIF, TIFF, HEIC, WEBP.',
      );
    }
    return this.medicationOrderParserService.parseOrder(file);
  }
}
