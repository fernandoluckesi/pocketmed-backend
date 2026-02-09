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

export enum ExamType {
  BLOOD_TEST = 'blood_test',
  URINE_TEST = 'urine_test',
  XRAY = 'xray',
  CT_SCAN = 'ct_scan',
  MRI = 'mri',
  ULTRASOUND = 'ultrasound',
  ECG = 'ecg',
  ENDOSCOPY = 'endoscopy',
  COLONOSCOPY = 'colonoscopy',
  BIOPSY = 'biopsy',
  OTHER = 'other',
}

export enum ExamStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: ExamType,
  })
  type: ExamType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date', nullable: true })
  scheduledDate: Date;

  @Column({
    type: 'enum',
    enum: ExamStatus,
    default: ExamStatus.SCHEDULED,
  })
  status: ExamStatus;

  @Column({ type: 'text', nullable: true })
  results: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  resultFile: string;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  laboratory: string;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, (doctor) => doctor.exams)
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid', nullable: true })
  patientId: string;

  @ManyToOne(() => Patient, (patient) => patient.exams, { nullable: true })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  dependentId: string;

  @ManyToOne(() => Dependent, (dependent) => dependent.exams, { nullable: true })
  @JoinColumn({ name: 'dependentId' })
  dependent: Dependent;

  @Column({ type: 'uuid', nullable: true })
  appointmentId: string;

  @ManyToOne(() => Appointment, (appointment) => appointment.exams, { nullable: true })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
