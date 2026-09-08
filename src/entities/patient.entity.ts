import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  ManyToMany,
} from 'typeorm';
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

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password: string;

  @Column({ type: 'varchar', length: 50 })
  gender: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

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

  @Column({ type: 'varchar', length: 6, nullable: true })
  verificationCode: string;

  @Column({ type: 'timestamp', nullable: true })
  verificationCodeExpiry: Date;

  @Column({ type: 'varchar', length: 6, nullable: true })
  passwordResetCode: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetCodeExpiry: Date;

  // Secure email-change flow: the requested new email awaiting confirmation,
  // plus the code sent to that new email and its expiry. Kept separate from
  // verificationCode to avoid colliding with other verification flows.
  @Column({ type: 'varchar', length: 255, nullable: true })
  pendingEmail: string | null;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
