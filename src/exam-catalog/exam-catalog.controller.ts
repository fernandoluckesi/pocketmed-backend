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
import { ExamCatalogService } from './exam-catalog.service';
import { ExamOrderParserService } from './exam-order-parser.service';
import { ListExamCatalogQueryDto } from './dto/list-exam-catalog.query.dto';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  createFileTypeValidationPipe,
  DOCUMENT_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE,
} from '../common/upload-validation';

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
      limits: { fileSize: MAX_UPLOAD_FILE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Parse a medical order file (PDF/image) and match exams from the catalog',
  })
  @ApiResponse({ status: 200, description: 'Returns exams matched from the order' })
  async parseOrder(
    @UploadedFile(
      createFileTypeValidationPipe({ allowedMimeTypes: DOCUMENT_MIME_TYPES, fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return this.examOrderParserService.parseOrder(file);
  }
}
