import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { Patient } from './patient.entity';
import { Dependent } from './dependent.entity';
import { Medication } from './medication.entity';
import { Exam } from './exam.entity';
import { FinancialConvenio } from './financial-convenio.entity';

export enum AppointmentStatus {
  PENDING = 'pending',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  doctorCrm: string;

  @Column({ type: 'varchar', length: 255 })
  doctorName: string;

  @Column({ type: 'varchar', length: 100 })
  doctorSpecialty: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'timestamp' })
  dateTime: Date;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'text', nullable: true })
  doctorFeedback: string;

  @Column({ type: 'text', nullable: true })
  doctorInstructions: string;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @Column({ type: 'uuid', nullable: true })
  doctorId: string | null;

  @ManyToOne(() => Doctor, (doctor) => doctor.appointments, { nullable: true })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid', nullable: true })
  patientId: string;

  @ManyToOne(() => Patient, (patient) => patient.appointments, { nullable: true })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  createdByPatientId: string;

  @ManyToOne(() => Patient, { nullable: true })
  @JoinColumn({ name: 'createdByPatientId' })
  createdByPatient: Patient;

  @Column({ type: 'uuid', nullable: true })
  dependentId: string;

  @ManyToOne(() => Dependent, (dependent) => dependent.appointments, { nullable: true })
  @JoinColumn({ name: 'dependentId' })
  dependent: Dependent;

  @OneToMany(() => Medication, (medication) => medication.appointment)
  medications: Medication[];

  @OneToMany(() => Exam, (exam) => exam.appointment)
  exams: Exam[];

  /** Tracks who last modified this appointment: 'doctor' or 'patient' */
  @Column({ type: 'varchar', length: 36, nullable: true })
  lastModifiedById: string | null;

  /** 'doctor' | 'patient' */
  @Column({ type: 'varchar', length: 10, nullable: true })
  lastModifiedByType: string | null;

  /** Once a doctor modifies, patient cannot edit/delete */
  @Column({ type: 'boolean', default: false })
  lockedByDoctor: boolean;

  /** 'consulta' | 'retorno' */
  @Column({ type: 'varchar', length: 20, default: 'consulta' })
  visitType: string;

  /** 'particular' | 'convenio' */
  @Column({ type: 'varchar', length: 20, default: 'particular' })
  paymentType: string;

  @Column({ type: 'uuid', nullable: true })
  convenioId: string | null;

  @ManyToOne(() => FinancialConvenio, { nullable: true })
  @JoinColumn({ name: 'convenioId' })
  convenio: FinancialConvenio;

  /**
   * Where the consultation takes place. When created from within a clinic
   * (staff scheduling, or a doctor with an active clinic), these are
   * snapshotted from the clinic's own address so the record stays accurate
   * even if the clinic later moves; otherwise a doctor can fill them by hand.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  locationClinicName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  locationStreet: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  locationNumber: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  locationNeighborhood: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  locationCity: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  locationState: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
