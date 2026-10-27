import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
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

  // Nullable desde a migration 1835: ao excluir uma conta cujo prontuário
  // deve ser retido, o contato é efetivamente apagado (NULL), e não
  // substituído por placeholder — placeholder continuaria ocupando o índice
  // único e impediria a pessoa de se recadastrar.
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email: string | null;

  @Exclude()
  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string;

  @Column({ type: 'varchar', length: 50 })
  gender: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  // Digits-only mirror of `phone`, maintained by the DB. Indexed so the phone
  // availability check is a direct lookup instead of scanning every row.
  // `select: false` keeps it out of normal queries.
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    select: false,
    asExpression: "REGEXP_REPLACE(phone, '[^0-9]', '')",
    generatedType: 'STORED',
  })
  phoneNormalized: string | null;

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

  // ── Retenção de prontuário (CFM 1.821/2007) × eliminação (LGPD) ──────────
  // Uma conta com prontuário não pode ser apagada: a guarda de 20 anos é
  // obrigação legal. Nesses casos o registro é marcado aqui em vez de
  // removido, e `deleteAccount` anonimiza os campos identificáveis
  // (email, telefone, foto, credenciais) mantendo nome/CPF — sem eles o
  // prontuário não identifica o titular e perde a função que justifica a
  // guarda. Conta SEM prontuário continua sendo apagada de verdade.
  //
  // `@DeleteDateColumn` faz o TypeORM excluir estas linhas de toda query
  // automaticamente, sem precisar espalhar `deletedAt IS NULL`. Consultas
  // que precisam ver o histórico retido usam `withDeleted: true`.
  @DeleteDateColumn()
  deletedAt: Date | null;

  /** Quando o titular pediu a exclusão. Distinto de `deletedAt` para fins de
   * auditoria: registra o pedido, não o efeito. */
  @Column({ type: 'datetime', nullable: true })
  deletionRequestedAt: Date | null;

  /** Data em que a guarda obrigatória expira (último registro clínico + 20
   * anos). O job de retenção elimina definitivamente a partir daqui. */
  @Column({ type: 'date', nullable: true })
  retentionUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
