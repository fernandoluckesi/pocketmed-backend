import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Clinic } from '../../entities/clinic.entity';
import { Doctor } from '../../entities/doctor.entity';

export enum InviteStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('clinic_doctor_invites')
@Index('IDX_invite_clinic_doctor_status', ['clinicId', 'doctorId', 'status'])
@Index('IDX_invite_doctor', ['doctorId'])
export class ClinicDoctorInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: '36' })
  clinicId: string;

  @Column({ type: 'varchar', length: '36' })
  doctorId: string;

  @Column({ type: 'varchar', length: '36' })
  invitedBy: string;

  @Column({
    type: 'enum',
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctorId' })
  doctor: Doctor;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitedBy' })
  inviter: Doctor;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
