import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';

/**
 * A patient's surgical history record. Follows the same pattern as
 * patient_diseases / patient_allergies / patient_vaccines (sub-resource of the
 * patient, FK with ON DELETE CASCADE, optional doctorId). Enums are stored as
 * short varchars with a documented string-literal union, matching the disease
 * `status` convention rather than a heavier MySQL enum column.
 */
@Entity('patient_surgeries')
export class PatientSurgery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Identification ──
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** 'PLANNED' | 'PERFORMED' | 'CANCELLED' */
  @Column({ type: 'varchar', length: 20, default: 'PLANNED' })
  status: string;

  @Column({ type: 'date', nullable: true })
  date: Date | null;

  // ── Reason & diagnosis ──
  @Column({ type: 'text', nullable: true })
  indication: string | null;

  /** Optional link to a patient_diseases record (same patient). */
  @Column({ type: 'uuid', nullable: true })
  diagnosisId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bodyRegion: string | null;

  /** 'RIGHT' | 'LEFT' | 'BILATERAL' | 'NOT_APPLICABLE' */
  @Column({ type: 'varchar', length: 20, nullable: true })
  laterality: string | null;

  // ── Location & professional ──
  @Column({ type: 'varchar', length: 255, nullable: true })
  hospitalOrClinic: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  surgeonName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  surgeonSpecialty: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  state: string | null;

  // ── Characteristics ──
  /** 'ELECTIVE' | 'URGENT' | 'EMERGENCY' */
  @Column({ type: 'varchar', length: 20, nullable: true })
  surgeryType: string | null;

  /** 'OPEN' | 'LAPAROSCOPIC' | 'ROBOTIC' | 'OTHER' */
  @Column({ type: 'varchar', length: 20, nullable: true })
  technique: string | null;

  /** 'GENERAL' | 'LOCAL' | 'REGIONAL' | 'SEDATION' | 'OTHER' */
  @Column({ type: 'varchar', length: 20, nullable: true })
  anesthesia: string | null;

  // ── Post-operative ──
  @Column({ type: 'text', nullable: true })
  outcome: string | null;

  @Column({ type: 'boolean', default: false })
  hadComplications: boolean;

  @Column({ type: 'text', nullable: true })
  complications: string | null;

  @Column({ type: 'boolean', default: false })
  hospitalAdmission: boolean;

  @Column({ type: 'date', nullable: true })
  dischargeDate: Date | null;

  @Column({ type: 'text', nullable: true })
  postoperativeNotes: string | null;

  // ── Permanent implant / prosthesis ──
  @Column({ type: 'boolean', default: false })
  hasPermanentImplant: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  implantType: string | null;

  @Column({ type: 'text', nullable: true })
  implantDescription: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  implantManufacturer: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  implantModel: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  implantSerial: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  implantLocation: string | null;

  // ── Ownership & control ──
  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  doctorId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
