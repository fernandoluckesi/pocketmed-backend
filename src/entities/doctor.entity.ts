import { Entity, Column, ChildEntity, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Appointment } from './appointment.entity';
import { Medication } from './medication.entity';
import { Exam } from './exam.entity';
import { Patient } from './patient.entity';
import { DoctorAccessRequest } from './doctor-access-request.entity';
import { DoctorPermission } from './doctor-permission.entity';

@ChildEntity('doctor')
export class Doctor extends User {
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
}
