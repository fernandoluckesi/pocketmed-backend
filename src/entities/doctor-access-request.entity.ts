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

export enum AccessRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  CANCELLED = 'cancelled',
}

export enum AccessRequestChannel {
  /** Patient already has an app account — confirms in-app, no token needed. */
  IN_APP = 'in_app',
  /** Shadow patient, no login — confirms via a single-use emailed link. */
  EMAIL_LINK = 'email_link',
}

@Entity('doctor_access_requests')
export class DoctorAccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, (doctor) => doctor.accessRequests)
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid', nullable: true })
  patientId: string;

  @ManyToOne(() => Patient, (patient) => patient.accessRequests, { nullable: true })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  dependentId: string;

  @ManyToOne(() => Dependent, { nullable: true })
  @JoinColumn({ name: 'dependentId' })
  dependent: Dependent;

  @Column({
    type: 'enum',
    enum: AccessRequestStatus,
    default: AccessRequestStatus.PENDING,
  })
  status: AccessRequestStatus;

  @Column({ type: 'text', nullable: true })
  message: string;

  /**
   * Cross-clinic access request fields (nullable — the original same-clinic
   * in-app flow doesn't set any of these). `requestingClinicId` is metadata
   * for display/audit only, NOT a security boundary: `PatientsService.findOne`
   * never checked clinic membership before this feature either, so this
   * column doesn't change that — it just lets the consent page and audit
   * trail say which clinic is asking.
   */
  @Column({ type: 'uuid', nullable: true })
  requestingClinicId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  purpose: string | null;

  @Column({
    type: 'enum',
    enum: AccessRequestChannel,
    nullable: true,
  })
  channel: AccessRequestChannel | null;

  /** SHA-256 hex digest of the single-use consent token — never the raw token. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  consentTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  consentTokenExpiresAt: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  consentTextVersion: string | null;

  @Column({ type: 'timestamp', nullable: true })
  linkSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
