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

export enum AppointmentStatus {
  PENDING = 'pending',
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
