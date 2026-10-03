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

export interface PrescriptionItem {
  name: string;
  concentration?: string;
  pharmaceuticalForm?: string;
  quantity?: string;
  posology?: string;
  routeOfAdministration?: string;
  treatmentDuration?: string;
}

/**
 * A formal prescription document ("receita") — a doctor-authored, printable
 * bundle of medications, distinct from the individual `Medication` rows
 * (those track ongoing treatment; `items` here is a frozen snapshot of what
 * was printed on this specific document). Prepared for a future digital
 * signature: never stores a certificate, password, or private key — only
 * the resulting signed PDF's URL/hash/provider metadata once that exists.
 */
@Entity('prescriptions')
export class Prescription {
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

  /** Frozen snapshot of the medications printed on this document — not a
   * live reference to `medications` rows (same reasoning as `Medication.times`
   * being stored as `json`: a small, self-contained structured array). */
  @Column({ type: 'json' })
  items: PrescriptionItem[];

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.DRAFT })
  status: DocumentStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentUrl: string | null;

  /** SHA-256 hex digest of the generated PDF. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  documentHash: string | null;

  @Column({ type: 'varchar', length: 50, default: 'prescription' })
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
