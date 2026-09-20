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

/** A medical leave certificate ("atestado") issued by a doctor for a
 * completed consultation. Simpler than doctor-documents: no review status. */
@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nullable: a patient self-reporting a certificate has no acting doctor
   * user — the issuing doctor's CRM is still captured in the `crm` column. */
  @Column({ type: 'uuid', nullable: true })
  doctorId: string | null;

  @ManyToOne(() => Doctor, { nullable: true })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid', nullable: true })
  patientId: string | null;

  @ManyToOne(() => Patient, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  dependentId: string | null;

  @ManyToOne(() => Dependent, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dependentId' })
  dependent: Dependent;

  @Column({ type: 'uuid', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => Appointment, { nullable: true })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment;

  /** Doctor's CRM as printed on the certificate — defaults to the doctor's
   * own CRM but kept editable/stored since a covering doctor may differ. */
  @Column({ type: 'varchar', length: 20 })
  crm: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cid: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', nullable: true })
  daysOff: number | null;

  @Column({ type: 'date', nullable: true })
  issueDate: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
