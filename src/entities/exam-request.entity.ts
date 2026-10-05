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
import { DocumentStatus } from '../documents/document.types';
import { SignatureStatus } from '../documents/signature/signature.types';

export interface ExamRequestItem {
  name: string;
}

/**
 * A formal exam-request document ("pedido de exame") — a doctor-authored,
 * printable/signable bundle of requested exams, distinct from the individual
 * `Exam` rows (those track scheduling/results; `items` here is a frozen
 * snapshot of what was printed on this specific document). Mirrors
 * `Prescription` exactly: same document/signature lifecycle, same
 * `DocumentGenerationService`/`SignatureService` infra, no second
 * implementation. Never stores a certificate/password/private key — only
 * the resulting PDF's URL/hash/provider metadata once signed.
 */
@Entity('exam_requests')
export class ExamRequest {
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

  @Column({ type: 'date' })
  issueDate: Date;

  /** Frozen snapshot of the exams printed on this document — not a live
   * reference to `exams` rows (same reasoning as `Prescription.items`). */
  @Column({ type: 'json' })
  items: ExamRequestItem[];

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentUrl: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  documentHash: string | null;

  @Column({ type: 'varchar', length: 50, default: 'exam_request' })
  documentType: string;

  @Column({ type: 'enum', enum: SignatureStatus, default: SignatureStatus.NONE })
  signatureStatus: SignatureStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  signatureProvider: string | null;

  @Column({ type: 'timestamp', nullable: true })
  signedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalSignatureId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
