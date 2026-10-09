import { MedicalDocumentSpec } from '../document.types';
import { SignatureStatus } from '../signature/signature.types';

/**
 * Shared visual language for every medical document (prescriptions, reports,
 * and whatever comes after) — header/patient block/signature area look and
 * behave identically across document types because they're drawn here once,
 * not copy-pasted per feature.
 */

/** Formats a date-only value (birthDate, issueDate — SQL `date` columns, no
 * time component) using UTC getters. `toLocaleDateString` would convert
 * through the server's local timezone first, which can shift a UTC-midnight
 * date back a day (e.g. '1990-05-20' rendering as 19/05/1990) — wrong for a
 * medical document's patient birthdate or issue date. */
function formatDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function drawDivider(doc: PDFKit.PDFDocument, color = '#e2e8f0'): void {
  const startX = doc.page.margins.left;
  const endX = doc.page.width - doc.page.margins.right;
  const y = doc.y;
  doc.moveTo(startX, y).lineTo(endX, y).strokeColor(color).lineWidth(1).stroke();
}

export function drawHeader(doc: PDFKit.PDFDocument, spec: MedicalDocumentSpec): void {
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#1a1a2e')
    .text(spec.title, { align: 'center' });
  doc.moveDown(0.3);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#64748b')
    .text('Hispora — Documento Médico Eletrônico', { align: 'center' });
  doc.moveDown(0.8);
  drawDivider(doc);
  doc.moveDown(0.6);

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a2e').text('Médico(a) responsável');
  doc.font('Helvetica').fontSize(10).fillColor('#334155');
  doc.text(spec.doctor.name);
  doc.text(`CRM: ${spec.doctor.crm}`);
  if (spec.doctor.specialty) {
    doc.text(`Especialidade: ${spec.doctor.specialty}`);
  }
  doc.moveDown(0.8);
}

export function drawPatientBlock(doc: PDFKit.PDFDocument, spec: MedicalDocumentSpec): void {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a2e').text('Paciente');
  doc.font('Helvetica').fontSize(10).fillColor('#334155');
  doc.text(spec.patient.name);
  if (spec.patient.cpf) doc.text(`CPF: ${spec.patient.cpf}`);
  if (spec.patient.birthDate) doc.text(`Data de nascimento: ${formatDate(spec.patient.birthDate)}`);
  if (spec.patient.gender) doc.text(`Sexo: ${spec.patient.gender}`);
  doc.moveDown(0.8);
}

export function drawIssueDate(doc: PDFKit.PDFDocument, spec: MedicalDocumentSpec): void {
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#64748b')
    .text(`Data de emissão: ${formatDate(spec.issueDate)}`);
  doc.moveDown(0.8);
  drawDivider(doc);
  doc.moveDown(0.8);
}

export function drawSignatureArea(doc: PDFKit.PDFDocument, signatureStatus: SignatureStatus): void {
  doc.moveDown(1.5);
  const startX = doc.page.margins.left;
  const endX = doc.page.width - doc.page.margins.right;
  const lineY = doc.y;
  doc.moveTo(startX, lineY).lineTo(endX, lineY).strokeColor('#94a3b8').lineWidth(1).stroke();
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Assinatura', { align: 'center' });
  doc.moveDown(0.5);

  // Only ever renders a "signed" claim once a real signature actually exists
  // (signatureStatus === SIGNED). Deliberately generic: naming a specific
  // standard (e.g. "ICP-Brasil") here would be a false claim about *how* it
  // was signed as long as the only provider wired in is MockSignatureProvider
  // (a UX simulation, not a real ICP-Brasil integration) — say only what's
  // actually true regardless of which provider produced the signature.
  if (signatureStatus === SignatureStatus.SIGNED) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#166534')
      .text('Documento assinado digitalmente.', { align: 'center' });
  } else {
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor('#b45309')
      .text('Documento gerado eletronicamente — assinatura digital ainda não configurada.', {
        align: 'center',
      });
  }
}

export function drawFooterDisclaimer(doc: PDFKit.PDFDocument): void {
  doc.moveDown(1);
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#94a3b8')
    .text(
      'Documento gerado pelo sistema Hispora. A autenticidade deste documento pode ser verificada junto à clínica/profissional emissor.',
      { align: 'center' },
    );
}
