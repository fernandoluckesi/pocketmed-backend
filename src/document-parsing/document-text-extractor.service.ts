import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';

/** Max time we allow OCR to run before giving up (keeps us under the gateway
 * timeout so a slow image returns a clean error instead of killing the app). */
const OCR_TIMEOUT_MS = 25_000;

/**
 * Extracts text from an uploaded document (image via OCR, or PDF via text
 * extraction). Shared by every feature that reads an attached file — exam
 * order matching, certificate field extraction, etc. — so the (expensive)
 * OCR worker is created once and reused across all of them.
 */
@Injectable()
export class DocumentTextExtractorService implements OnModuleInit {
  private readonly logger = new Logger(DocumentTextExtractorService.name);

  /**
   * A single Tesseract worker is created lazily and reused across requests.
   * Creating a worker downloads the WASM core and the language traineddata,
   * which is expensive; doing it once (instead of per request) avoids
   * repeated downloads that made image parsing time out on the hosting
   * platform.
   */
  private ocrWorkerPromise: Promise<any> | null = null;

  onModuleInit(): void {
    // Warm the OCR worker in the background at startup so the first image
    // request doesn't pay the (slow) worker-creation/traineddata-download cost.
    // Failure here is non-fatal — it just means the first request warms it.
    this.getOcrWorker().catch((err) => {
      this.logger.warn(
        `OCR worker warm-up failed (will retry on first use): ${(err as Error).message}`,
      );
    });
  }

  private async getOcrWorker(): Promise<any> {
    if (!this.ocrWorkerPromise) {
      this.ocrWorkerPromise = (async () => {
        const { createWorker } = await import('tesseract.js');
        // Portuguese only — documents here are in pt-BR. Loading a single
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

  async extractText(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

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

    throw new BadRequestException('Formato de arquivo não suportado. Envie PDF ou imagem.');
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
      timer = setTimeout(() => reject(new Error('OCR timed out')), OCR_TIMEOUT_MS);
    });

    try {
      const result = (await Promise.race([worker.recognize(buffer), timeout])) as {
        data?: { text?: string };
      };
      return result?.data?.text ?? '';
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Lowercase, strip accents, collapse whitespace. */
  normalize(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
}
