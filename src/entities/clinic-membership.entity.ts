import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Clinic } from './clinic.entity';
import { Doctor } from './doctor.entity';
import { ProfessionalRole } from '../auth/professional-role.enum';

@Entity('clinic_memberships')
@Unique('UQ_clinic_memberships_clinic_professional', ['clinicId', 'professionalId'])
export class ClinicMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clinicId: string;

  @Column({ type: 'uuid' })
  professionalId: string;

  @Column({ type: 'varchar', length: 20, default: ProfessionalRole.DOCTOR })
  role: ProfessionalRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  invitedBy: string | null;

  // Overrides the clinic's defaultDoctorTransferPercentage (FinancialSettings)
  // for this specific doctor. Null means "use the clinic default".
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  transferPercentage: number | null;

  @ManyToOne(() => Clinic, (clinic) => clinic.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @ManyToOne(() => Doctor, (doctor) => doctor.clinicMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professionalId' })
  professional: Doctor;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
