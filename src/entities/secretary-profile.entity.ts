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
import { Exclude } from 'class-transformer';
import { Doctor } from './doctor.entity';
import { Clinic } from './clinic.entity';
import { cpfColumnTransformer } from '../common/cpf-encryption.util';

@Entity('secretary_profiles')
@Unique('UQ_secretary_profiles_professional', ['professionalId'])
@Unique('UQ_secretary_profiles_email', ['email'])
export class SecretaryProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  professionalId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImage: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gender: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: Date | null;

  // Plaintext at the application layer; encrypted at rest transparently via
  // cpfColumnTransformer — see src/common/cpf-encryption.util.ts.
  @Column({ type: 'varchar', length: 64, nullable: true, transformer: cpfColumnTransformer })
  cpf: string | null;

  @Column({ type: 'uuid', nullable: true })
  clinicId: string | null;

  @ManyToOne(() => Doctor, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'professionalId' })
  professional: Doctor | null;

  @ManyToOne(() => Clinic, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
