import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Doctor } from './doctor.entity';
import { Patient } from './patient.entity';
import { Dependent } from './dependent.entity';

@Entity('doctor_permissions')
export class DoctorPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Doctor, (doctor) => doctor.permissions)
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @Column({ type: 'uuid', nullable: true })
  patientId: string;

  @ManyToOne(() => Patient, (patient) => patient.permissions, { nullable: true })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  dependentId: string;

  @ManyToOne(() => Dependent, { nullable: true })
  @JoinColumn({ name: 'dependentId' })
  dependent: Dependent;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  grantedAt: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  revokedAt: Date | null;

  /**
   * Null = permanent grant (the original behavior, e.g. same-clinic
   * DoctorAccessRequest approval). Set = temporary window (cross-clinic
   * consent grants, 2h by default) — PatientsService.findOne must treat an
   * expired-but-still-isActive row as no longer granting access.
   */
  @Column({ type: 'timestamp', nullable: true, default: null })
  expiresAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  sourceRequestId: string | null;
}
