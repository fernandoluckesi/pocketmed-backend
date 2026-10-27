import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  ManyToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Appointment } from './appointment.entity';
import { Medication } from './medication.entity';
import { Exam } from './exam.entity';
import { Doctor } from './doctor.entity';
import { Dependent } from './dependent.entity';
import { DoctorAccessRequest } from './doctor-access-request.entity';
import { DoctorPermission } from './doctor-permission.entity';

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Required for patients who self-register on mobile; null for shadow
  // patients (created by a doctor, never self-register). Globally unique
  // when present — see migration 1834 (IDX_patients_username_unique).
  @Column({ type: 'varchar', length: 30, nullable: true })
  username: string | null;

  // Nullable desde a migration 1835: ao excluir uma conta cujo prontuário
  // deve ser retido, o contato é efetivamente apagado (NULL), e não
  // substituído por placeholder — placeholder continuaria ocupando o índice
  // único e impediria a pessoa de se recadastrar.
  @Column({ type: 'varchar', length: 255, nullable: true })
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

  // Personal identifier (11 digits, no mask). Nullable so onboarding isn't
  // blocked; the patient can fill it later in the profile. Uniqueness is
  // enforced in application code (not a DB constraint) because of the shadow
  // account / merge model.
  @Column({ type: 'varchar', length: 11, nullable: true })
  cpf: string | null;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImage: string;

  @Column({ type: 'varchar', length: 20, default: 'patient' })
  type: string;

  @Column({ type: 'boolean', default: false })
  isShadow: boolean;

  // Tracks the outcome of the welcome/invite email sent when a shadow patient
  // is created (or re-sent later). Patient creation no longer rolls back when
  // the email fails — this lets staff see it failed and retry via
  // POST /patients/:id/resend-invite instead of the account being silently
  // stuck with no invite ever delivered.
  @Column({ type: 'varchar', length: 20, nullable: true })
  inviteEmailStatus: 'sent' | 'failed' | null;

  @Column({ type: 'timestamp', nullable: true })
  inviteEmailSentAt: Date | null;

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

  @Column({ type: 'uuid', nullable: true })
  doctorCreatorId: string;

  @ManyToOne(() => Doctor, { nullable: true })
  @JoinColumn({ name: 'doctorCreatorId' })
  doctorCreator: Doctor;

  @OneToMany(() => Appointment, (appointment) => appointment.patient)
  appointments: Appointment[];

  @OneToMany(() => Medication, (medication) => medication.patient)
  medications: Medication[];

  @OneToMany(() => Exam, (exam) => exam.patient)
  exams: Exam[];

  @ManyToMany(() => Dependent, (dependent) => dependent.responsibles)
  dependents: Dependent[];

  @OneToMany(() => DoctorAccessRequest, (request) => request.patient)
  accessRequests: DoctorAccessRequest[];

  @OneToMany(() => DoctorPermission, (permission) => permission.patient)
  permissions: DoctorPermission[];

  /** List of chronic conditions/diseases */
  @Column({ type: 'json', nullable: true })
  diseases: string[] | null;

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
