import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamCatalog } from '../entities/exam-catalog.entity';

/** Max time we allow OCR to run before giving up (keeps us under the gateway
 * timeout so a slow image returns a clean error instead of killing the app). */
const OCR_TIMEOUT_MS = 25_000;

/**
 * Extracts text from an uploaded medical order (image via OCR or PDF text
 * extraction) and matches the content against the exam catalog.
 */
@Injectable()
export class ExamOrderParserService implements OnModuleInit {
  private readonly logger = new Logger(ExamOrderParserService.name);

  /**
   * A single Tesseract worker is created lazily and reused across requests.
   * Creating a worker downloads the WASM core and the language traineddata,
   * which is expensive; doing it once (instead of per request, as the old
   * top-level `recognize()` did) avoids repeated downloads that made image
   * parsing time out on the hosting platform.
   */
  private ocrWorkerPromise: Promise<any> | null = null;

  constructor(
    @InjectRepository(ExamCatalog)
    private readonly examCatalogRepository: Repository<ExamCatalog>,
  ) {}

  onModuleInit(): void {
    // Warm the OCR worker in the background at startup so the first image
    // request doesn't pay the (slow) worker-creation/traineddata-download cost.
    // Failure here is non-fatal — it just means the first request warms it.
    this.getOcrWorker().catch((err) => {
      this.logger.warn(
        `OCR worker warm-up failed (will retry on first use): ${
          (err as Error).message
        }`,
      );
    });
  }

  private async getOcrWorker(): Promise<any> {
    if (!this.ocrWorkerPromise) {
      this.ocrWorkerPromise = (async () => {
        const { createWorker } = await import('tesseract.js');
        // Portuguese only — medical orders here are in pt-BR. Loading a single
        // language roughly halves the traineddata download and per-run cost
        // versus 'por+eng'.
        return createWorker('por');
      })().catch((err) => {
        // Reset so a later request can retry worker creation.
        this.ocrWorkerPromise = null;
        throw err;
      });
    }
    return this.ocrWorkerPromise;
  }

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
    const worker = await this.getOcrWorker();

    // Guard the recognize call with a timeout. OCR on a large photo can run for
    // tens of seconds; without this the request would hang until the hosting
    // gateway kills the whole process ("Application failed to respond").
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('OCR timed out')),
        OCR_TIMEOUT_MS,
      );
    });

    try {
      const result = (await Promise.race([
        worker.recognize(buffer),
        timeout,
      ])) as { data?: { text?: string } };
      return result?.data?.text ?? '';
    } finally {
      if (timer) clearTimeout(timer);
    }
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
