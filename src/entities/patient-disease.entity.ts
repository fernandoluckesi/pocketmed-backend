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

@Entity('patient_diseases')
export class PatientDisease {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** 'in_treatment' | 'treatment_ended' | 'treatment_suspended' | 'cured' */
  @Column({ type: 'varchar', length: 30, default: 'in_treatment' })
  status: string;

  @Column({ type: 'text', nullable: true })
  observations: string | null;

  @Column({ type: 'date', nullable: true })
  diagnosisDate: Date | null;

  @Column({ type: 'date', nullable: true })
  treatmentStartDate: Date | null;

  @Column({ type: 'date', nullable: true })
  treatmentEndDate: Date | null;

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
