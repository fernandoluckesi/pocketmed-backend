import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Appointment } from './appointment.entity';
import { Medication } from './medication.entity';
import { Exam } from './exam.entity';

@Entity('dependents')
export class Dependent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  gender: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImage: string;

  @Column({ type: 'uuid' })
  adminResponsibleId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'adminResponsibleId' })
  adminResponsible: Patient;

  @ManyToMany(() => Patient, (patient) => patient.dependents)
  @JoinTable({
    name: 'dependent_responsibles',
    joinColumn: { name: 'dependentId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'patientId', referencedColumnName: 'id' },
  })
  responsibles: Patient[];

  @OneToMany(() => Appointment, (appointment) => appointment.dependent)
  appointments: Appointment[];

  @OneToMany(() => Medication, (medication) => medication.dependent)
  medications: Medication[];

  @OneToMany(() => Exam, (exam) => exam.dependent)
  exams: Exam[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
