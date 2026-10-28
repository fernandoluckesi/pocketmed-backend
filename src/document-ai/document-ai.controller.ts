import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { createFileTypeValidationPipe } from '../common/upload-validation';
import { detectMimeFromBuffer } from '../common/file-signature';
import { DocumentProcessingService } from './document-processing.service';

/**
 * AI document extraction endpoints. The AI vendor is never reached from the
 * frontend — it talks only to this backend, which validates access, format and
 * size, and returns Hispora's official JSON contract (see the spec at
 * archives/docs/ia-use/opea-ia.md). The extracted data is "to be reviewed":
 * the client must present it for confirmation before anything is persisted.
 */

// Formats the vision/file API handles well. TIFF/HEIC are intentionally
// excluded here even though the platform accepts them elsewhere.
const AI_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MAX_AI_DOCUMENT_SIZE = 15 * 1024 * 1024; // 15MB

@ApiTags('Document AI')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class DocumentAiController {
  constructor(private readonly documentProcessingService: DocumentProcessingService) {}

  @Get('ai-status')
  @ApiOperation({ summary: 'Whether AI document extraction is enabled in this environment' })
  @ApiResponse({ status: 200, description: 'Returns { enabled }' })
  async status() {
    return { enabled: this.documentProcessingService.isEnabled() };
  }

  @Post('extract')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AI_DOCUMENT_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Extract structured fields from a medical document (receita/guia) via AI',
  })
  @ApiResponse({ status: 201, description: "Hispora's official extraction contract (to review)" })
  @ApiResponse({ status: 403, description: 'AI document extraction disabled' })
  async extract(
    @CurrentUser() user: any,
    @UploadedFile(
      createFileTypeValidationPipe({
        allowedMimeTypes: AI_DOCUMENT_MIME_TYPES,
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Nenhum arquivo enviado.');
    }

    // Trust the magic-byte-detected type, not the client-declared mimetype.
    const detected = detectMimeFromBuffer(file.buffer);
    if (!detected || !AI_DOCUMENT_MIME_TYPES.includes(detected)) {
      throw new BadRequestException(
        'Formato não suportado. Envie PDF, JPEG, PNG, GIF ou WEBP.',
      );
    }

    return this.documentProcessingService.extractFromDocument({
      buffer: file.buffer,
      mimeType: detected,
      filename: file.originalname || 'document',
      userId: user.userId,
    });
  }
}
