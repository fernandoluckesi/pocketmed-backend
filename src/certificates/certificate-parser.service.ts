import { Injectable } from '@nestjs/common';
import { DocumentTextExtractorService } from '../document-parsing/document-text-extractor.service';

export interface ParsedCertificateFields {
  crmNumber: string | null;
  crmUf: string | null;
  cid: string | null;
  description: string | null;
  daysOff: number | null;
  issueDate: string | null;
}

const BRAZILIAN_UFS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

/**
 * Extracts CRM (number + state)/CID/description/daysOff/issueDate from an
 * attached certificate (PDF or image), using the same OCR/PDF text extraction
 * as the exam order parser. Unlike exams (matched against a fixed catalog),
 * certificate fields are free text, so this is regex-based best-effort — the
 * caller always keeps the fields editable for whatever isn't found or comes
 * out wrong.
 */
@Injectable()
export class CertificateParserService {
  constructor(private readonly textExtractor: DocumentTextExtractorService) {}

  async parseCertificate(file: Express.Multer.File): Promise<ParsedCertificateFields> {
    const text = await this.textExtractor.extractText(file);
    const { crmNumber, crmUf } = this.extractCrm(text);

    return {
      crmNumber,
      crmUf,
      cid: this.extractCid(text),
      daysOff: this.extractDaysOff(text),
      issueDate: this.extractIssueDate(text),
      description: this.extractDescription(text),
    };
  }

  /** "CRM/SP 123456", "CRM-SP: 123.456", "CRM nº 123456 SP", "CRM 123456/SP" */
  private extractCrm(text: string): { crmNumber: string | null; crmUf: string | null } {
    const match = text.match(
      /CRM[\s\-/:]*n?[ºo°]?[\s\-/:]*([A-Z]{2})?[\s\-/:]*(\d[\d.]{2,8})[\s\-/:]*([A-Z]{2})?/i,
    );
    if (!match) return { crmNumber: null, crmUf: null };

    const digits = match[2].replace(/\D/g, '');
    if (!digits) return { crmNumber: null, crmUf: null };

    const candidateUf = (match[1] || match[3] || '').toUpperCase();
    const crmUf = BRAZILIAN_UFS.has(candidateUf) ? candidateUf : null;

    return { crmNumber: digits, crmUf };
  }

  /** CID-10 code: one letter + two digits + optional ".digit" (e.g. J11, J11.0). */
  private extractCid(text: string): string | null {
    const nearCid = text.match(/CID[\s\-:]*(?:10)?[\s\-:]*([A-Z]\d{2}(?:\.\d)?)/i);
    if (nearCid) return nearCid[1].toUpperCase();

    const anyCid = text.match(/\b([A-Z]\d{2}(?:\.\d)?)\b/);
    return anyCid ? anyCid[1].toUpperCase() : null;
  }

  /** "3 dias", "afastamento de 5 (cinco) dias", etc. */
  private extractDaysOff(text: string): number | null {
    const match = text.match(/(\d{1,3})\s*\(?[^)]{0,15}\)?\s*dias?/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    return Number.isNaN(value) ? null : value;
  }

  /** First dd/mm/yyyy (or dd-mm-yyyy / dd.mm.yyyy) date found, as ISO yyyy-mm-dd. */
  private extractIssueDate(text: string): string | null {
    const match = text.match(/\b(\d{2})[/\-.](\d{2})[/\-.](\d{4})\b/);
    if (!match) return null;

    const [, day, month, year] = match;
    const dayNum = Number(day);
    const monthNum = Number(month);
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) return null;

    return `${year}-${month}-${day}`;
  }

  /** The sentence around the typical "atesto que ..." certificate boilerplate. */
  private extractDescription(text: string): string | null {
    const match = text.match(/atesto[^.\n]{0,280}[.\n]/i);
    if (!match) return null;
    return match[0]
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.\s]+$/, '');
  }
}
