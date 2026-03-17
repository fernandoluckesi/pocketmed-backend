import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Appointment } from './appointment.entity';
import { Medication } from './medication.entity';
import { Exam } from './exam.entity';
import { Patient } from './patient.entity';
import { DoctorAccessRequest } from './doctor-access-request.entity';
import { DoctorPermission } from './doctor-permission.entity';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

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

  @Column({ type: 'varchar', length: 6, nullable: true })
  verificationCode: string;

  @Column({ type: 'timestamp', nullable: true })
  verificationCodeExpiry: Date;

  @Column({ type: 'varchar', length: 6, nullable: true })
  passwordResetCode: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetCodeExpiry: Date;

  @Column({ type: 'varchar', length: 100 })
  specialty: string;

  @Column({ type: 'varchar', length: 20 })
  crm: string;

  @Column({ type: 'varchar', length: 14 })
  cpf: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
