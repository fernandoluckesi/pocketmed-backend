import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { In } from 'typeorm';
import AppDataSource from '../data-source';
import { seedClinic } from './seed-clinic';
import { seedExamCatalog } from './seed-exam-catalog';
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

const COMMON_FIRST_NAMES = [
  'Joao',
  'Maria',
  'Jose',
  'Ana',
  'Carlos',
  'Paulo',
  'Pedro',
  'Lucas',
  'Mateus',
  'Gabriel',
  'Rafael',
  'Bruno',
  'Ricardo',
  'Marcos',
  'Fernando',
  'Roberto',
  'Juliana',
  'Camila',
  'Fernanda',
  'Patricia',
  'Aline',
  'Beatriz',
  'Renata',
  'Carla',
  'Amanda',
];

const COMMON_LAST_NAMES = [
  'Silva',
  'Santos',
  'Oliveira',
  'Souza',
  'Lima',
  'Pereira',
  'Costa',
  'Rodrigues',
  'Almeida',
  'Nascimento',
  'Araujo',
  'Fernandes',
  'Carvalho',
  'Gomes',
  'Martins',
  'Rocha',
  'Dias',
  'Ribeiro',
  'Teixeira',
  'Barbosa',
  'Freitas',
  'Mendes',
  'Castro',
  'Moura',
  'Moreira',
];

function normalizeEmailPart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function buildPatientBase(index: number) {
  const firstName = COMMON_FIRST_NAMES[index % COMMON_FIRST_NAMES.length];
  const lastName =
    COMMON_LAST_NAMES[Math.floor(index / COMMON_FIRST_NAMES.length) % COMMON_LAST_NAMES.length];

  return {
    name: `${firstName} da ${lastName}`,
    email: `${normalizeEmailPart(firstName)}.${normalizeEmailPart(lastName)}@email.com`,
  };
}

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

  const doctorPasswordHash = await bcrypt.hash('123456', 10);
  const patientPasswordHash = await bcrypt.hash('958969', 10);

  let doctor = await doctorRepository.findOne({
    where: { email: 'doctor.seed@pocketmed.com' },
  });

  if (!doctor) {
    doctor = doctorRepository.create({
      name: 'Dr. Seed PocketMed',
      email: 'doctor.seed@pocketmed.com',
      password: doctorPasswordHash,
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
      password: patientPasswordHash,
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

  const targetPatientCount = 150;
  const generatedPatients = Array.from({ length: targetPatientCount }, (_, index) =>
    buildPatientBase(index),
  );

  const generatedEmails = generatedPatients.map((item) => item.email);
  const existingPatients = await patientRepository.find({
    where: { email: In(generatedEmails) },
    select: ['email'],
  });

  const existingEmailSet = new Set(existingPatients.map((item) => item.email));

  const patientsToCreate = generatedPatients
    .filter((item) => !existingEmailSet.has(item.email))
    .map((item, index) => {
      const gender = index % 2 === 0 ? 'male' : 'female';
      const day = (index % 28) + 1;
      const month = (index % 12) + 1;
      const year = 1970 + (index % 35);

      return patientRepository.create({
        name: item.name,
        email: item.email,
        password: patientPasswordHash,
        gender,
        phone: `1197${String(index + 1000000).slice(-7)}`,
        birthDate: new Date(
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        ),
        profileImage: null,
        type: 'patient',
        isShadow: false,
        doctorCreatorId: null,
      });
    });

  if (patientsToCreate.length > 0) {
    await patientRepository.save(patientsToCreate);
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

  // ── Dr. Fernando Luckesi ──────────────────────────────────────────────────────
  const fernandoPasswordHash = await bcrypt.hash('958969', 10);

  let drFernando = await doctorRepository.findOne({
    where: { email: 'fernando.luckesi.dr@gmail.com' },
  });

  if (!drFernando) {
    drFernando = doctorRepository.create({
      name: 'DR. Fernando Luckesi',
      email: 'fernando.luckesi.dr@gmail.com',
      password: fernandoPasswordHash,
      gender: 'male',
      phone: '11977777777',
      birthDate: new Date('1990-08-15'),
      specialty: 'Clínica Geral',
      crm: 'CRM-SP-99999',
      cpf: '99988877766',
      profileImage: null,
      type: 'doctor',
      isShadow: false,
    });

    drFernando = await doctorRepository.save(drFernando);
  }

  // ── 50 pacientes extras para Dr. Fernando ───────────────────────────────────
  const FERNANDO_PATIENT_NAMES = [
    'Thiago Mendes', 'Larissa Campos', 'Diego Ferreira', 'Isabela Rocha', 'Vinicius Alves',
    'Natalia Borges', 'Gustavo Pinto', 'Mariana Duarte', 'Leandro Cunha', 'Priscila Monteiro',
    'Henrique Lopes', 'Tatiana Vieira', 'Rodrigo Barros', 'Vanessa Cardoso', 'Fabio Teixeira',
    'Daniela Ramos', 'Marcelo Farias', 'Simone Correia', 'Andre Nogueira', 'Leticia Melo',
    'Caio Rezende', 'Raquel Azevedo', 'Felipe Braga', 'Juliana Pires', 'Eduardo Sampaio',
    'Adriana Fonseca', 'Renato Machado', 'Cristiane Neves', 'Sergio Alencar', 'Monica Tavares',
    'Alexandre Brito', 'Flavia Guimaraes', 'Luciano Andrade', 'Elaine Siqueira', 'Matheus Coelho',
    'Debora Lacerda', 'Wagner Bastos', 'Cintia Marques', 'Otavio Rangel', 'Sabrina Pacheco',
    'Leonardo Vasconcelos', 'Bianca Medeiros', 'Renan Cavalcanti', 'Camila Fontes', 'Hugo Batista',
    'Fernanda Queiroz', 'Tiago Moraes', 'Aline Santana', 'Murilo Dantas', 'Carolina Esteves',
  ];

  const fernandoPatients: Patient[] = [];

  for (let i = 0; i < FERNANDO_PATIENT_NAMES.length; i++) {
    const fullName = FERNANDO_PATIENT_NAMES[i];
    const emailName = fullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '.');
    const email = `${emailName}@email.com`;

    let p = await patientRepository.findOne({ where: { email } });

    if (!p) {
      const gender = i % 2 === 0 ? 'male' : 'female';
      const day = (i % 28) + 1;
      const month = (i % 12) + 1;
      const year = 1975 + (i % 30);

      p = patientRepository.create({
        name: fullName,
        email,
        password: patientPasswordHash,
        gender,
        phone: `1196${String(i + 2000000).slice(-7)}`,
        birthDate: new Date(
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        ),
        profileImage: null,
        type: 'patient',
        isShadow: false,
        doctorCreatorId: null,
      });

      p = await patientRepository.save(p);
    }

    fernandoPatients.push(p);
  }

  // ── Permissões: Dr. Fernando tem acesso aos 10 primeiros pacientes ──────────
  const patientsWithAccess = fernandoPatients.slice(0, 10);

  for (const fp of patientsWithAccess) {
    const existingPermission = await permissionRepository.findOne({
      where: { doctorId: drFernando.id, patientId: fp.id, dependentId: null },
    });

    if (!existingPermission) {
      const perm = permissionRepository.create({
        doctorId: drFernando.id,
        patientId: fp.id,
        dependentId: null,
        isActive: true,
      });
      await permissionRepository.save(perm);
    }

    // Criar access request aprovado correspondente
    const existingRequest = await accessRequestRepository.findOne({
      where: {
        doctorId: drFernando.id,
        patientId: fp.id,
        dependentId: null,
        status: AccessRequestStatus.APPROVED,
      },
    });

    if (!existingRequest) {
      const req = accessRequestRepository.create({
        doctorId: drFernando.id,
        patientId: fp.id,
        dependentId: null,
        status: AccessRequestStatus.APPROVED,
        message: 'Acesso concedido via seed',
      });
      await accessRequestRepository.save(req);
    }
  }

  console.log('Seed finalizada com sucesso.');
  console.log('Doctor login: doctor.seed@pocketmed.com / 123456');
  console.log('Doctor login: fernando.luckesi.dr@gmail.com / 958969');
  console.log('Patient login: patient.seed@pocketmed.com / 958969');
  console.log(
    `Pacientes comuns existentes/criados para login: ${generatedPatients.length} com senha 958969`,
  );
  console.log(
    `Pacientes Dr. Fernando: ${fernandoPatients.length} criados, ${patientsWithAccess.length} com acesso concedido`,
  );

  await seedClinic();
  await seedExamCatalog();

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
