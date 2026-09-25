import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicationCatalog } from '../entities/medication-catalog.entity';
import { DocumentTextExtractorService } from '../document-parsing/document-text-extractor.service';

/** Cap on how many candidate lines we'll turn into DB lookups per document —
 * the catalog has ~26k rows, so this bounds the parse to one query per
 * plausible medication line instead of ever loading the whole table. */
const MAX_CANDIDATES = 20;

export interface MatchedMedication {
  id: string;
  product: string;
  substance: string;
}

/**
 * Extracts text from an uploaded prescription (image via OCR or PDF text
 * extraction) and matches each plausible medication line against the
 * ANVISA-backed medication catalog.
 */
@Injectable()
export class MedicationOrderParserService {
  constructor(
    @InjectRepository(MedicationCatalog)
    private readonly medicationCatalogRepository: Repository<MedicationCatalog>,
    private readonly textExtractor: DocumentTextExtractorService,
  ) {}

  async parseOrder(file: Express.Multer.File): Promise<{
    matchedMedications: MatchedMedication[];
    rawTextLength: number;
  }> {
    const text = await this.textExtractor.extractText(file);

    if (!text.trim()) {
      return { matchedMedications: [], rawTextLength: 0 };
    }

    const matchedMedications = await this.matchMedications(text);

    return { matchedMedications, rawTextLength: text.length };
  }

  /**
   * Pulls plausible medication-name candidates out of free text: one per
   * non-trivial line, keeping the leading run of letters (a medication name
   * is normally followed by a dosage number/unit), e.g.
   * "1. Losartana Potássica 50mg — 1x ao dia" -> "Losartana Potássica".
   */
  private extractCandidateNames(text: string): string[] {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\s\-•*\d.)]+/, '').trim())
      .filter((line) => line.length >= 3 && line.length <= 80 && /[a-zA-ZÀ-ÿ]/.test(line));

    const candidates: string[] = [];
    for (const line of lines) {
      const match = line.match(/^[a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ\s]{2,40}/);
      const name = (match ? match[0] : line).trim();
      if (name.length >= 3) candidates.push(name);
      if (candidates.length >= MAX_CANDIDATES * 2) break;
    }

    return candidates.slice(0, MAX_CANDIDATES);
  }

  private async matchMedications(text: string): Promise<MatchedMedication[]> {
    const candidates = this.extractCandidateNames(text);
    const matched: MatchedMedication[] = [];
    const seenProducts = new Set<string>();

    for (const candidate of candidates) {
      const found = await this.medicationCatalogRepository
        .createQueryBuilder('med')
        .where('LOWER(med.product) LIKE :term', { term: `%${candidate.toLowerCase()}%` })
        .orWhere('LOWER(med.substance) LIKE :term', { term: `%${candidate.toLowerCase()}%` })
        .orderBy('med.product', 'ASC')
        .getOne();

      if (found && !seenProducts.has(found.product)) {
        seenProducts.add(found.product);
        matched.push({ id: found.id, product: found.product, substance: found.substance });
      }
    }

    return matched;
  }
}
