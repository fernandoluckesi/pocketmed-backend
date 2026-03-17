import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import AppDataSource from '../data-source';
import { Doctor } from '../../entities/doctor.entity';
import { Patient } from '../../entities/patient.entity';
import { Dependent } from '../../entities/dependent.entity';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { Medication, MedicationFrequency } from '../../entities/medication.entity';
import { Exam, ExamStatus, ExamType } from '../../entities/exam.entity';
import {
  DoctorAccessRequest,
  AccessRequestStatus,
} from '../../entities/doctor-access-request.entity';
import { DoctorPermission } from '../../entities/doctor-permission.entity';

export async function seedDatabase() {
  const shouldDestroyConnection = !AppDataSource.isInitialized;

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const doctorRepository = AppDataSource.getRepository(Doctor);
  const patientRepository = AppDataSource.getRepository(Patient);
  const dependentRepository = AppDataSource.getRepository(Dependent);
  const appointmentRepository = AppDataSource.getRepository(Appointment);
  const medicationRepository = AppDataSource.getRepository(Medication);
  const examRepository = AppDataSource.getRepository(Exam);
  const accessRequestRepository = AppDataSource.getRepository(DoctorAccessRequest);
  const permissionRepository = AppDataSource.getRepository(DoctorPermission);

  const passwordHash = await bcrypt.hash('123456', 10);

  let doctor = await doctorRepository.findOne({
    where: { email: 'doctor.seed@pocketmed.com' },
  });

  if (!doctor) {
    doctor = doctorRepository.create({
      name: 'Dr. Seed PocketMed',
      email: 'doctor.seed@pocketmed.com',
      password: passwordHash,
      gender: 'male',
      phone: '11999999999',
      birthDate: new Date('1985-05-10'),
      specialty: 'Cardiologia',
      crm: 'CRM-SP-12345',
      cpf: '12345678901',
      profileImage: null,
      type: 'doctor',
      isShadow: false,
    });

    doctor = await doctorRepository.save(doctor);
  }

  let patient = await patientRepository.findOne({
    where: { email: 'patient.seed@pocketmed.com' },
  });

  if (!patient) {
    patient = patientRepository.create({
      name: 'Paciente Seed PocketMed',
      email: 'patient.seed@pocketmed.com',
      password: passwordHash,
      gender: 'female',
      phone: '11988888888',
      birthDate: new Date('1993-11-20'),
      profileImage: null,
      type: 'patient',
      isShadow: false,
      doctorCreatorId: null,
    });

    patient = await patientRepository.save(patient);
  }

  let dependent = await dependentRepository.findOne({
    where: { name: 'Dependente Seed PocketMed', adminResponsibleId: patient.id },
    relations: ['responsibles'],
  });

  if (!dependent) {
    dependent = dependentRepository.create({
      name: 'Dependente Seed PocketMed',
      gender: 'male',
      type: 'filho',
      birthDate: new Date('2016-03-15'),
      profileImage: null,
      adminResponsibleId: patient.id,
      responsibles: [patient],
    });

    dependent = await dependentRepository.save(dependent);
  } else {
    const hasResponsible = dependent.responsibles?.some(
      (responsible) => responsible.id === patient.id,
    );

    if (!hasResponsible) {
      dependent.responsibles = [...(dependent.responsibles || []), patient];
      dependent = await dependentRepository.save(dependent);
    }
  }

  let patientPermission = await permissionRepository.findOne({
    where: { doctorId: doctor.id, patientId: patient.id, dependentId: null },
  });

  if (!patientPermission) {
    patientPermission = permissionRepository.create({
      doctorId: doctor.id,
      patientId: patient.id,
      dependentId: null,
      isActive: true,
    });
    await permissionRepository.save(patientPermission);
  }

  let dependentPermission = await permissionRepository.findOne({
    where: { doctorId: doctor.id, patientId: null, dependentId: dependent.id },
  });

  if (!dependentPermission) {
    dependentPermission = permissionRepository.create({
      doctorId: doctor.id,
      patientId: null,
      dependentId: dependent.id,
      isActive: true,
    });
    await permissionRepository.save(dependentPermission);
  }

  let patientAppointment = await appointmentRepository.findOne({
    where: { doctorId: doctor.id, patientId: patient.id, dependentId: null },
  });

  if (!patientAppointment) {
    patientAppointment = appointmentRepository.create({
      doctorId: doctor.id,
      patientId: patient.id,
      dependentId: null,
      doctorCrm: doctor.crm,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      reason: 'Consulta de rotina para teste de response',
      dateTime: new Date(),
      isCompleted: false,
      status: AppointmentStatus.APPROVED,
    });

    patientAppointment = await appointmentRepository.save(patientAppointment);
  }

  let dependentAppointment = await appointmentRepository.findOne({
    where: { doctorId: doctor.id, patientId: null, dependentId: dependent.id },
  });

  if (!dependentAppointment) {
    dependentAppointment = appointmentRepository.create({
      doctorId: doctor.id,
      patientId: null,
      dependentId: dependent.id,
      doctorCrm: doctor.crm,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      reason: 'Acompanhamento pediátrico para teste de response',
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isCompleted: false,
      status: AppointmentStatus.PENDING,
    });

    dependentAppointment = await appointmentRepository.save(dependentAppointment);
  }

  let medication = await medicationRepository.findOne({
    where: { doctorId: doctor.id, patientId: patient.id, name: 'Losartana 50mg' },
  });

  if (!medication) {
    medication = medicationRepository.create({
      name: 'Losartana 50mg',
      dosage: '1 comprimido',
      frequency: MedicationFrequency.ONCE_DAILY,
      times: ['08:00'],
      startDate: new Date(),
      endDate: null,
      duration: null,
      instructions: 'Tomar após o café da manhã',
      isActive: true,
      isFinished: false,
      doctorId: doctor.id,
      patientId: patient.id,
      dependentId: null,
      appointmentId: patientAppointment.id,
    });

    await medicationRepository.save(medication);
  }

  let exam = await examRepository.findOne({
    where: { doctorId: doctor.id, dependentId: dependent.id, name: 'Hemograma completo' },
  });

  if (!exam) {
    exam = examRepository.create({
      name: 'Hemograma completo',
      type: ExamType.BLOOD_TEST,
      description: 'Exame de rotina para teste',
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: ExamStatus.SCHEDULED,
      observations: 'Levar documento com foto',
      laboratory: 'Laboratório Central',
      doctorId: doctor.id,
      patientId: null,
      dependentId: dependent.id,
      appointmentId: dependentAppointment.id,
    });

    await examRepository.save(exam);
  }

  let accessRequest = await accessRequestRepository.findOne({
    where: {
      doctorId: doctor.id,
      patientId: patient.id,
      dependentId: null,
      status: AccessRequestStatus.APPROVED,
    },
  });

  if (!accessRequest) {
    accessRequest = accessRequestRepository.create({
      doctorId: doctor.id,
      patientId: patient.id,
      dependentId: null,
      status: AccessRequestStatus.APPROVED,
      message: 'Solicitação seed para validar joins de doctor/patient',
    });

    await accessRequestRepository.save(accessRequest);
  }

  console.log('Seed finalizada com sucesso.');
  console.log('Doctor login: doctor.seed@pocketmed.com / 123456');
  console.log('Patient login: patient.seed@pocketmed.com / 123456');

  if (shouldDestroyConnection && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  seedDatabase().catch(async (error) => {
    console.error('Erro ao executar seed:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  });
}
