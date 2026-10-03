import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import PDFDocument from 'pdfkit';
import { UploadService } from '../upload/upload.service';
import { MedicalDocumentSpec } from './document.types';
import {
  drawFooterDisclaimer,
  drawHeader,
  drawIssueDate,
  drawPatientBlock,
  drawSignatureArea,
} from './rendering/pdf-shell';
import { drawKeyValuesSection } from './rendering/key-values-table';
import { renderProseMirrorDoc } from './rendering/prosemirror-to-pdfkit';

/**
 * The single place every medical document (prescriptions, reports, and
 * later atestados/exam requests) turns structured data into a PDF, hashes
 * it, and stores it — so none of those features duplicate PDF-drawing or
 * storage logic, and all look visually consistent by construction.
 */
@Injectable()
export class DocumentGenerationService {
  constructor(private readonly uploadService: UploadService) {}

  async renderToBuffer(spec: MedicalDocumentSpec): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      drawHeader(doc, spec);
      drawPatientBlock(doc, spec);
      drawIssueDate(doc, spec);

      for (const section of spec.sections) {
        if (section.kind === 'key-values') {
          drawKeyValuesSection(doc, section);
        } else if (section.kind === 'plain-text') {
          if (!section.text) continue;
          if (section.heading) {
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e').text(section.heading);
            doc.moveDown(0.25);
          }
          doc.font('Helvetica').fontSize(10).fillColor('#334155').text(section.text, {
            align: 'justify',
          });
          doc.moveDown(0.6);
        } else if (section.kind === 'rich-text') {
          if (!section.content) continue;
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e').text(section.heading);
          doc.moveDown(0.25);
          renderProseMirrorDoc(doc, section.content);
          doc.moveDown(0.4);
        }
      }

      drawSignatureArea(doc, spec.signatureStatus);
      drawFooterDisclaimer(doc);

      doc.end();
    });
  }

  computeHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /** Stores a generated PDF through the existing upload abstraction (R2/MinIO
   * today) — reusing it rather than building a second storage path. */
  async store(buffer: Buffer, opts: { folder: string; filenameHint: string }): Promise<string> {
    const syntheticFile = {
      originalname: `${opts.filenameHint}.pdf`,
      mimetype: 'application/pdf',
      buffer,
      size: buffer.length,
    } as Express.Multer.File;

    return this.uploadService.uploadFile(syntheticFile, opts.folder);
  }
}
