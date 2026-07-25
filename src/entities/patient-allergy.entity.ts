import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

@Entity('patient_allergies')
export class PatientAllergy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** 'mild' | 'moderate' | 'severe' */
  @Column({ type: 'varchar', length: 20, default: 'moderate' })
  severity: string;

  @Column({ type: 'text', nullable: true })
  reaction: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  doctorId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
