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
import { Dependent } from './dependent.entity';

export enum ResponsibleInviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('dependent_responsible_invites')
export class DependentResponsibleInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  dependentId: string;

  @ManyToOne(() => Dependent, { nullable: false })
  @JoinColumn({ name: 'dependentId' })
  dependent: Dependent;

  /** Patient who sent the invite (must be the dependent's adminResponsible). */
  @Column({ type: 'uuid' })
  inviterPatientId: string;

  @ManyToOne(() => Patient, { nullable: false })
  @JoinColumn({ name: 'inviterPatientId' })
  inviter: Patient;

  /** Patient being invited to become a responsible. */
  @Column({ type: 'uuid' })
  inviteePatientId: string;

  @ManyToOne(() => Patient, { nullable: false })
  @JoinColumn({ name: 'inviteePatientId' })
  invitee: Patient;

  /** Email used to resolve the invitee (kept for auditing). */
  @Column({ type: 'varchar', length: 255 })
  inviteeEmail: string;

  @Column({
    type: 'enum',
    enum: ResponsibleInviteStatus,
    default: ResponsibleInviteStatus.PENDING,
  })
  status: ResponsibleInviteStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
