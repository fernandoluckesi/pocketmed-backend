import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { Patient } from './patient.entity';
import { Dependent } from './dependent.entity';
import { Appointment } from './appointment.entity';
import { DocumentStatus, ProseMirrorDoc } from '../documents/document.types';
import { SignatureStatus } from '../documents/signature/signature.types';

export enum ReportType {
  LAUDO_MEDICO = 'laudo_medico',
  LAUDO_EXAME = 'laudo_exame',
  RELATORIO_MEDICO = 'relatorio_medico',
  RELATORIO_ACOMPANHAMENTO = 'relatorio_acompanhamento',
  LAUDO_ADMINISTRATIVO = 'laudo_administrativo',
  LAUDO_TRABALHISTA = 'laudo_trabalhista',
  LAUDO_PREVIDENCIARIO = 'laudo_previdenciario',
  OUTRO = 'outro',
}

/** Human-readable labels, used wherever a report type is printed (the PDF
 * title falls back to this when no title was given). The frontend keeps its
 * own copy for the select — same values, same order. */
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  [ReportType.LAUDO_MEDICO]: 'Laudo médico',
  [ReportType.LAUDO_EXAME]: 'Laudo de exame',
  [ReportType.RELATORIO_MEDICO]: 'Relatório médico',
  [ReportType.RELATORIO_ACOMPANHAMENTO]: 'Relatório de acompanhamento',
  [ReportType.LAUDO_ADMINISTRATIVO]: 'Laudo para fins administrativos',
  [ReportType.LAUDO_TRABALHISTA]: 'Laudo para fins trabalhistas',
  [ReportType.LAUDO_PREVIDENCIARIO]: 'Laudo para fins previdenciários',
  [ReportType.OUTRO]: 'Outro',
};

/**
 * A medical report ("laudo") — richer and more free-form than a Prescription:
 * nine independently-optional rich-text clinical fields (Tiptap/ProseMirror
 * JSON, rendered via `rendering/prosemirror-to-pdfkit.ts`) instead of a fixed
 * medication table. Shares the same document/signature lifecycle columns and
 * `DocumentGenerationService`/`SignatureService` infra as Prescription —
 * no second PDF or signature implementation.
 *
 * Doctor/patient identification is snapshotted at creation time (mirrors how
 * `Prescription.generatePdf` reads doctor/patient data): the doctor's own
 * data is never editable from the Laudo form, and a later profile edit must
 * not silently rewrite an already-issued document's printed identification.
 *
 * `supersedesReportId` is a forward-looking hook for versioning: once signed,
 * a laudo is immutable (enforced in `ReportsService`), so a correction must
 * create a new row pointing back at the one it replaces rather than editing
 * it in place. Always null today — no versioning flow exists yet.
 */
@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor)
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid', nullable: true })
  patientId: string | null;

  @ManyToOne(() => Patient, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  dependentId: string | null;

  @ManyToOne(() => Dependent, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dependentId' })
  dependent: Dependent;

  @Column({ type: 'uuid', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => Appointment, { nullable: true })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @Column({ type: 'enum', enum: ReportType })
  reportType: ReportType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reportTypeOther: string | null;

  @Column({ type: 'date' })
  issueDate: Date;

  @Column({ type: 'date', nullable: true })
  relatedServiceDate: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  purpose: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  // --- Doctor/patient identification, snapshotted at creation time ---

  @Column({ type: 'varchar', length: 255 })
  doctorNameSnapshot: string;

  @Column({ type: 'varchar', length: 20 })
  doctorCrmSnapshot: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  doctorSpecialtySnapshot: string | null;

  @Column({ type: 'varchar', length: 255 })
  patientNameSnapshot: string;

  @Column({ type: 'varchar', length: 14, nullable: true })
  patientCpfSnapshot: string | null;

  @Column({ type: 'date', nullable: true })
  patientBirthDateSnapshot: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  patientGenderSnapshot: string | null;

  // --- Clinical content (Tiptap/ProseMirror JSON, independently optional) ---

  @Column({ type: 'json', nullable: true })
  chiefComplaint: ProseMirrorDoc | null;

  @Column({ type: 'json', nullable: true })
  clinicalHistory: ProseMirrorDoc | null;

  @Column({ type: 'json', nullable: true })
  physicalExam: ProseMirrorDoc | null;

  @Column({ type: 'json', nullable: true })
  complementaryExams: ProseMirrorDoc | null;

  @Column({ type: 'json', nullable: true })
  results: ProseMirrorDoc | null;

  @Column({ type: 'json', nullable: true })
  diagnosis: ProseMirrorDoc | null;

  @Column({ type: 'json', nullable: true })
  conclusion: ProseMirrorDoc | null;

  @Column({ type: 'json', nullable: true })
  recommendations: ProseMirrorDoc | null;

  @Column({ type: 'json', nullable: true })
  observations: ProseMirrorDoc | null;

  // --- Document/signature lifecycle (same shape as Prescription) ---

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  /** PDF generated by `DocumentGenerationService` from this laudo's own
   * structured content. Distinct from `fileUrl`. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  documentUrl: string | null;

  /** A pre-existing document uploaded by the doctor — e.g. a laudo issued
   * years ago, outside Hispora, now being filed in the patient's record.
   * Deliberately separate from `documentUrl`: this one Hispora did not
   * produce and must never present as if it had, and a laudo can legitimately
   * have one, the other, or both. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  /** Plain text extracted (via OCR for images, text layer for PDFs) from a
   * patient-uploaded laudo file, so the app can show the laudo's content on
   * screen in addition to the file itself. Only populated for laudos the
   * patient filed from an external document — doctor-authored laudos carry
   * their content in the structured ProseMirror fields instead. */
  @Column({ type: 'text', nullable: true })
  extractedText: string | null;

  /** True when the patient filed this laudo themselves by uploading an
   * external file (OCR-read), as opposed to a doctor authoring it in Hispora.
   * Patients may only read/manage laudos flagged this way. */
  @Column({ type: 'boolean', default: false })
  createdByPatient: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  documentHash: string | null;

  @Column({ type: 'varchar', length: 50, default: 'report' })
  documentType: string;

  @Column({ type: 'enum', enum: SignatureStatus, default: SignatureStatus.NONE })
  signatureStatus: SignatureStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  signatureProvider: string | null;

  @Column({ type: 'timestamp', nullable: true })
  signedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalSignatureId: string | null;

  @Column({ type: 'uuid', nullable: true })
  supersedesReportId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
