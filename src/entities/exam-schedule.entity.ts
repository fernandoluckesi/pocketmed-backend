import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Dependent } from './dependent.entity';
import { ExamScheduleItem } from './exam-schedule-item.entity';

export enum ExamScheduleStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

@Entity('exam_schedules')
export class ExamSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  // When set, the schedule belongs to this dependent (the responsible patient
  // in patientId manages it). Null means it belongs to the patient directly.
  @Column({ type: 'uuid', nullable: true })
  dependentId: string | null;

  @ManyToOne(() => Dependent, { nullable: true })
  @JoinColumn({ name: 'dependentId' })
  dependent: Dependent | null;

  @Column({ type: 'timestamp' })
  scheduledDateTime: Date;

  @Column({
    type: 'enum',
    enum: ExamScheduleStatus,
    default: ExamScheduleStatus.PENDING,
  })
  status: ExamScheduleStatus;

  @Column({ type: 'text', nullable: true })
  resultText: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  resultFileUrl: string | null;

  @OneToMany(() => ExamScheduleItem, (item) => item.examSchedule)
  items: ExamScheduleItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
