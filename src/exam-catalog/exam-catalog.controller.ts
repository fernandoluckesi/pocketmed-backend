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
import { ExamCatalogService } from './exam-catalog.service';
import { ExamOrderParserService } from './exam-order-parser.service';
import { ListExamCatalogQueryDto } from './dto/list-exam-catalog.query.dto';
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

@ApiTags('Exam Catalog')
@Controller('exam-catalog')
export class ExamCatalogController {
  constructor(
    private readonly examCatalogService: ExamCatalogService,
    private readonly examOrderParserService: ExamOrderParserService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List exam catalog with optional search and category filter' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of exams' })
  async findAll(@Query() query: ListExamCatalogQueryDto) {
    return this.examCatalogService.findAll(query);
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'List all exam categories' })
  @ApiResponse({ status: 200, description: 'Returns all exam categories' })
  async findAllCategories() {
    return this.examCatalogService.findAllCategories();
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
    summary: 'Parse a medical order file (PDF/image) and match exams from the catalog',
  })
  @ApiResponse({ status: 200, description: 'Returns exams matched from the order' })
  async parseOrder(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato não suportado. Aceitos: PDF, JPEG, JPG, PNG, GIF, TIFF, HEIC, WEBP.',
      );
    }
    return this.examOrderParserService.parseOrder(file);
  }
}
