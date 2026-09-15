import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Internal Hispora staff account (platform back office).
 *
 * These users are NOT tied to a clinic: they operate across the whole platform
 * (e.g. reviewing doctor credential documents), so there is no clinicId here.
 * Accounts are provisioned internally (seed/CLI) — there is no public sign-up.
 */
export enum BackofficeRole {
  /** Can review submissions and manage other back office users. */
  SUPERADMIN = 'superadmin',
  /** Can review doctor documents (approve/reject). */
  ANALYST = 'analyst',
  /** Read-only access, including audit trail. */
  AUDITOR = 'auditor',
}

@Entity('backoffice_users')
export class BackofficeUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({
    type: 'enum',
    enum: BackofficeRole,
    default: BackofficeRole.ANALYST,
  })
  backofficeRole: BackofficeRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'varchar', length: 6, nullable: true })
  passwordResetCode: string | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetCodeExpiry: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
