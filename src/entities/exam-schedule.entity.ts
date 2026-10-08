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
import { MedicalAttachment } from './medical-attachment.entity';

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

  // When the schedule was created as part of a consultation, it is linked to
  // the appointment. Null for standalone exam schedules.
  @Column({ type: 'uuid', nullable: true })
  appointmentId: string | null;

  // Optional: an exam prescribed during a consultation may not be scheduled to
  // a date/time yet. Null means "not scheduled".
  @Column({ type: 'timestamp', nullable: true })
  scheduledDateTime: Date | null;

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

  /** Optional link to the uploaded exam-order ("guia") file this schedule came
   * from. One guia is shared by all the exam items in the schedule. Distinct
   * from `resultFileUrl`, which is the exam RESULT uploaded afterwards. */
  @Column({ type: 'uuid', nullable: true })
  attachmentId: string | null;

  @ManyToOne(() => MedicalAttachment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'attachmentId' })
  attachment: MedicalAttachment | null;

  @OneToMany(() => ExamScheduleItem, (item) => item.examSchedule)
  items: ExamScheduleItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
