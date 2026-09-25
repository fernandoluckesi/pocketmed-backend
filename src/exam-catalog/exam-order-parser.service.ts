import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamCatalog } from '../entities/exam-catalog.entity';
import { DocumentTextExtractorService } from '../document-parsing/document-text-extractor.service';

/**
 * Extracts text from an uploaded medical order (image via OCR or PDF text
 * extraction) and matches the content against the exam catalog.
 */
@Injectable()
export class ExamOrderParserService {
  constructor(
    @InjectRepository(ExamCatalog)
    private readonly examCatalogRepository: Repository<ExamCatalog>,
    private readonly textExtractor: DocumentTextExtractorService,
  ) {}

  async parseOrder(file: Express.Multer.File): Promise<{
    matchedExams: Pick<ExamCatalog, 'id' | 'name'>[];
    rawTextLength: number;
  }> {
    const text = await this.textExtractor.extractText(file);
    const normalizedText = this.textExtractor.normalize(text);

    if (!normalizedText.trim()) {
      return { matchedExams: [], rawTextLength: 0 };
    }

    const matchedExams = await this.matchExams(normalizedText);

    return { matchedExams, rawTextLength: text.length };
  }

  /**
   * Match the extracted text against the catalog. An exam is considered a match
   * when its normalized name (or any of its synonyms) appears as a substring in
   * the extracted text.
   */
  private async matchExams(normalizedText: string): Promise<Pick<ExamCatalog, 'id' | 'name'>[]> {
    const catalog = await this.examCatalogRepository.find({
      where: { isActive: true },
      select: ['id', 'name', 'synonyms'],
    });

    const matched: Pick<ExamCatalog, 'id' | 'name'>[] = [];

    for (const exam of catalog) {
      const candidates = [exam.name, ...(exam.synonyms?.split(',') ?? [])]
        .map((c) => this.textExtractor.normalize(c.trim()))
        .filter((c) => c.length >= 3);

      const isMatch = candidates.some((candidate) => normalizedText.includes(candidate));

      if (isMatch) {
        matched.push({ id: exam.id, name: exam.name });
      }
    }

    return matched;
  }
}
