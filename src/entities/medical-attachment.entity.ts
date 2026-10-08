import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Dependent } from './dependent.entity';
import { Appointment } from './appointment.entity';

export enum MedicalAttachmentKind {
  /** A prescription ("receita") the patient uploaded — shared by the N
   * medications it prescribes. */
  RECEITA = 'receita',
  /** An exam order ("guia") the patient uploaded — shared by the N exams it
   * requests. */
  GUIA = 'guia',
}

/**
 * A single file the PATIENT uploaded (a receita for medications, or a guia for
 * exams) that can be shared by MANY item rows: one receita file linked to the
 * 3 medications it lists, one guia linked to the exams it requests. Modeled as
 * its own entity (referenced by `medications.attachmentId` / `exams.attachmentId`)
 * rather than a URL column on each item, so the file + its OCR text live in one
 * place and the stored object is deleted once when the attachment is removed.
 *
 * Distinct from the doctor-authored `Prescription`/`ExamRequest` (which Hispora
 * GENERATES) — this is purely an external document the patient filed.
 */
@Entity('medical_attachments')
export class MedicalAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MedicalAttachmentKind })
  kind: MedicalAttachmentKind;

  /** Public URL of the stored file (PDF or image), in object storage. */
  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  /** Plain text read from the file (PDF text layer or OCR for images), shown
   * on screen alongside the file. Null when extraction found nothing. */
  @Column({ type: 'text', nullable: true })
  extractedText: string | null;

  @Column({ type: 'uuid', nullable: true })
  patientId: string | null;

  @ManyToOne(() => Patient, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient | null;

  @Column({ type: 'uuid', nullable: true })
  dependentId: string | null;

  @ManyToOne(() => Dependent, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dependentId' })
  dependent: Dependent | null;

  @Column({ type: 'uuid', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment | null;

  /** Always true today — these are patient-filed uploads. Kept explicit so a
   * future doctor-upload path can share the table without ambiguity. */
  @Column({ type: 'boolean', default: true })
  createdByPatient: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
