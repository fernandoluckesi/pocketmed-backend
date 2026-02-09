import { Entity, Column, ChildEntity, OneToMany, ManyToOne, JoinColumn, ManyToMany } from 'typeorm';
import { User } from './user.entity';
import { Appointment } from './appointment.entity';
import { Medication } from './medication.entity';
import { Exam } from './exam.entity';
import { Doctor } from './doctor.entity';
import { Dependent } from './dependent.entity';
import { DoctorAccessRequest } from './doctor-access-request.entity';
import { DoctorPermission } from './doctor-permission.entity';

@ChildEntity('patient')
export class Patient extends User {
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
}
