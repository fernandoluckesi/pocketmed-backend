import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Appointment } from './appointment.entity';
import { Medication } from './medication.entity';
import { Exam } from './exam.entity';
import { Patient } from './patient.entity';
import { DoctorAccessRequest } from './doctor-access-request.entity';
import { DoctorPermission } from './doctor-permission.entity';
import { ClinicMembership } from './clinic-membership.entity';
import { DoctorDocument } from './doctor-document.entity';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string;

  @Column({ type: 'varchar', length: 50 })
  gender: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImage: string;

  @Column({ type: 'varchar', length: 20, default: 'doctor' })
  type: string;

  @Column({ type: 'boolean', default: false })
  isShadow: boolean;

  @Exclude()
  @Column({ type: 'varchar', length: 6, nullable: true })
  verificationCode: string;

  @Column({ type: 'timestamp', nullable: true })
  verificationCodeExpiry: Date;

  @Exclude()
  @Column({ type: 'varchar', length: 6, nullable: true })
  passwordResetCode: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetCodeExpiry: Date;

  // Secure email-change flow: the requested new email awaiting confirmation,
  // plus the code sent to that new email and its expiry. Kept separate from
  // verificationCode to avoid colliding with other verification flows.
  @Column({ type: 'varchar', length: 255, nullable: true })
  pendingEmail: string | null;

  @Exclude()
  @Column({ type: 'varchar', length: 6, nullable: true })
  emailChangeCode: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailChangeCodeExpiry: Date | null;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 100 })
  specialty: string;

  /**
   * Canonical "number/UF" form (e.g. "123456/SP"), derived from
   * `crmNumber`/`crmUf` on every write.
   *
   * @deprecated as a source of truth — read `crmNumber`/`crmUf` instead.
   * Kept and kept-in-sync because mobile and backoffice are deployed
   * independently and still read this column; dropping it would break them
   * mid-rollout. Historically it held several incompatible shapes
   * ("123456/SP", "SP-123456", "CRM-SP-00001"), which made uniqueness checks
   * and search unreliable — see `common/crm.util.ts`.
   */
  @Column({ type: 'varchar', length: 20 })
  crm: string;

  /** Registration number, digits only (leading zeros preserved). Source of
   * truth, together with `crmUf`. Nullable because synthetic accounts
   * (secretaries) have no real CRM. */
  @Column({ type: 'varchar', length: 15, nullable: true })
  crmNumber: string | null;

  /** Issuing state (2-letter UF, uppercase). The CFM web service queries by
   * number + UF, so these must be separately addressable. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  crmUf: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  rqe: string;

  @Column({ type: 'varchar', length: 14 })
  cpf: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  verificationStatus: string; // PENDING, SUBMITTED, APPROVED, REJECTED

  @OneToMany(() => Patient, (patient) => patient.doctorCreator)
  shadowPatientsCreated: Patient[];

  @OneToMany(() => Appointment, (appointment) => appointment.doctor)
  appointments: Appointment[];

  @OneToMany(() => Medication, (medication) => medication.doctor)
  medications: Medication[];

  @OneToMany(() => Exam, (exam) => exam.doctor)
  exams: Exam[];

  @OneToMany(() => DoctorAccessRequest, (request) => request.doctor)
  accessRequests: DoctorAccessRequest[];

  @OneToMany(() => DoctorPermission, (permission) => permission.doctor)
  permissions: DoctorPermission[];

  @OneToMany(() => ClinicMembership, (membership) => membership.professional)
  clinicMemberships: ClinicMembership[];

  @OneToMany(() => DoctorDocument, (doc) => doc.doctor)
  documents: DoctorDocument[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
