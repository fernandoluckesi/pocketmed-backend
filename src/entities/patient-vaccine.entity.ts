import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';

@Entity('patient_vaccines')
export class PatientVaccine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  dose: string | null;

  @Column({ type: 'date', nullable: true })
  applicationDate: Date | null;

  @Column({ type: 'date', nullable: true })
  nextDoseDate: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  laboratory: string | null;

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
