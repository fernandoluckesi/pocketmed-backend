import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('patient_access_logs')
export class PatientAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  patientId: string;

  @Column({ type: 'varchar', length: 36 })
  accessedBy: string;

  @Column({ type: 'varchar', length: 50 })
  action: string; // VIEW_RECORD, VIEW_MEDICATIONS, CREATE_CONSULTATION, PRESCRIBE_MEDICATION, UPDATE_PATIENT, EXPORT_RECORD

  @Column({ type: 'varchar', length: 255, nullable: true })
  details: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
