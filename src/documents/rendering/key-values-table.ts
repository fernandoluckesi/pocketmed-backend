import { DocumentSection } from '../document.types';

type KeyValuesSection = Extract<DocumentSection, { kind: 'key-values' }>;

/** Renders a labeled block (e.g. one medication's name/concentration/form/
 * quantity/posology/route/duration) as bold-label + value lines. */
export function drawKeyValuesSection(doc: PDFKit.PDFDocument, section: KeyValuesSection): void {
  if (section.heading) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e').text(section.heading);
    doc.moveDown(0.25);
  }

  for (const item of section.items) {
    if (!item.value) continue;
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor('#334155')
      .text(`${item.label}: `, { continued: true });
    doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(item.value);
  }

  doc.moveDown(0.6);
}
