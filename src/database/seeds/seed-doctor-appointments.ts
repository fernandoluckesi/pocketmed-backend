import 'reflect-metadata';
import 'dotenv/config';
import AppDataSource from '../data-source';

async function run() {
  await AppDataSource.initialize();

  // Get doctor
  const [doctor] = await AppDataSource.query(
    "SELECT id, name, specialty, crm FROM doctors WHERE email = 'fernando.luckesi.dr@gmail.com' LIMIT 1",
  );
  if (!doctor) {
    console.log('Doctor not found');
    await AppDataSource.destroy();
    return;
  }
  console.log('Doctor:', doctor.name, doctor.id);

  // Get patients
  const patients = await AppDataSource.query(
    'SELECT id, name FROM patients WHERE isShadow = 0 LIMIT 10',
  );
  console.log('Patients found:', patients.length);

  if (patients.length === 0) {
    console.log('No patients to create appointments for');
    await AppDataSource.destroy();
    return;
  }

  const doctorName = `Dr. ${doctor.name}`;
  const specialty = doctor.specialty || 'Clinica Geral';
  const crm = doctor.crm || '12345/SP';

  // Create appointments with various statuses and dates
  const appointmentsData = [
    {
      patientIdx: 0,
      date: '2025-08-15 09:00:00',
      reason: 'Check-up de rotina',
      status: 'completed',
      isCompleted: 1,
    },
    {
      patientIdx: 0,
      date: '2025-08-20 10:30:00',
      reason: 'Retorno - exames laboratoriais',
      status: 'approved',
      isCompleted: 0,
    },
    {
      patientIdx: 0,
      date: '2025-09-05 14:00:00',
      reason: 'Acompanhamento hipertensao',
      status: 'pending',
      isCompleted: 0,
    },
    {
      patientIdx: 1 % patients.length,
      date: '2025-08-10 08:30:00',
      reason: 'Primeira consulta',
      status: 'completed',
      isCompleted: 1,
    },
    {
      patientIdx: 1 % patients.length,
      date: '2025-08-18 11:00:00',
      reason: 'Dor no peito',
      status: 'completed',
      isCompleted: 1,
    },
    {
      patientIdx: 1 % patients.length,
      date: '2025-09-12 15:00:00',
      reason: 'Retorno cardiologico',
      status: 'pending',
      isCompleted: 0,
    },
    {
      patientIdx: 2 % patients.length,
      date: '2025-07-28 09:30:00',
      reason: 'Exame de vista',
      status: 'completed',
      isCompleted: 1,
    },
    {
      patientIdx: 2 % patients.length,
      date: '2025-08-22 16:00:00',
      reason: 'Controle glicemico',
      status: 'approved',
      isCompleted: 0,
    },
    {
      patientIdx: 3 % patients.length,
      date: '2025-08-05 10:00:00',
      reason: 'Dor de cabeca recorrente',
      status: 'completed',
      isCompleted: 1,
    },
    {
      patientIdx: 3 % patients.length,
      date: '2025-09-01 08:00:00',
      reason: 'Check-up anual',
      status: 'rejected',
      isCompleted: 0,
    },
    {
      patientIdx: 4 % patients.length,
      date: '2025-08-12 14:30:00',
      reason: 'Vacinacao e orientações',
      status: 'completed',
      isCompleted: 1,
    },
    {
      patientIdx: 4 % patients.length,
      date: '2025-09-20 11:30:00',
      reason: 'Acompanhamento pos-cirurgico',
      status: 'pending',
      isCompleted: 0,
    },
  ];

  for (const apt of appointmentsData) {
    const patient = patients[apt.patientIdx];
    await AppDataSource.query(
      `INSERT INTO appointments (id, patientId, doctorId, dateTime, reason, doctorName, doctorCrm, doctorSpecialty, isCompleted, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        patient.id,
        doctor.id,
        apt.date,
        apt.reason,
        doctorName,
        crm,
        specialty,
        apt.isCompleted,
        apt.status,
      ],
    );
  }

  console.log(`Created ${appointmentsData.length} appointments for Dr. ${doctor.name}`);
  await AppDataSource.destroy();
  console.log('Done!');
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
