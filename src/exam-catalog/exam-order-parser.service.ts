import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamCatalog } from '../entities/exam-catalog.entity';

/**
 * Extracts text from an uploaded medical order (image via OCR or PDF text
 * extraction) and matches the content against the exam catalog.
 */
@Injectable()
export class ExamOrderParserService {
  private readonly logger = new Logger(ExamOrderParserService.name);

  constructor(
    @InjectRepository(ExamCatalog)
    private readonly examCatalogRepository: Repository<ExamCatalog>,
  ) {}

  async parseOrder(file: Express.Multer.File): Promise<{
    matchedExams: Pick<ExamCatalog, 'id' | 'name'>[];
    rawTextLength: number;
  }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const text = await this.extractText(file);
    const normalizedText = this.normalize(text);

    if (!normalizedText.trim()) {
      return { matchedExams: [], rawTextLength: 0 };
    }

    const matchedExams = await this.matchExams(normalizedText);

    return { matchedExams, rawTextLength: text.length };
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    const mimetype = file.mimetype || '';

    try {
      if (mimetype === 'application/pdf') {
        return await this.extractPdfText(file.buffer);
      }
      if (mimetype.startsWith('image/')) {
        return await this.extractImageText(file.buffer);
      }
    } catch (err) {
      this.logger.error(`Text extraction failed: ${(err as Error).message}`);
      throw new BadRequestException('Não foi possível ler o arquivo enviado.');
    }

    throw new BadRequestException(
      'Formato de arquivo não suportado. Envie PDF ou imagem.',
    );
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    // Lazy import to avoid loading the lib at startup
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text ?? '';
    } finally {
      await parser.destroy();
    }
  }

  private async extractImageText(buffer: Buffer): Promise<string> {
    const { recognize } = await import('tesseract.js');
    // Portuguese + English language data for medical orders
    const { data } = await recognize(buffer, 'por+eng');
    return data.text ?? '';
  }

  /** Lowercase, strip accents, collapse whitespace. */
  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Match the extracted text against the catalog. An exam is considered a match
   * when its normalized name (or any of its synonyms) appears as a substring in
   * the extracted text.
   */
  private async matchExams(
    normalizedText: string,
  ): Promise<Pick<ExamCatalog, 'id' | 'name'>[]> {
    const catalog = await this.examCatalogRepository.find({
      where: { isActive: true },
      select: ['id', 'name', 'synonyms'],
    });

    const matched: Pick<ExamCatalog, 'id' | 'name'>[] = [];

    for (const exam of catalog) {
      const candidates = [exam.name, ...(exam.synonyms?.split(',') ?? [])]
        .map((c) => this.normalize(c.trim()))
        .filter((c) => c.length >= 3);

      const isMatch = candidates.some((candidate) =>
        normalizedText.includes(candidate),
      );

      if (isMatch) {
        matched.push({ id: exam.id, name: exam.name });
      }
    }

    return matched;
  }
}
