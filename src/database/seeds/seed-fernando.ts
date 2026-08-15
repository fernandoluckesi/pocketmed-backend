import 'reflect-metadata';
import 'dotenv/config';
import AppDataSource from '../data-source';

async function run() {
  await AppDataSource.initialize();

  // Get patient id
  const patients = await AppDataSource.query(
    "SELECT id FROM patients WHERE email = 'fernando.luckesi94@gmail.com' LIMIT 1",
  );
  if (patients.length === 0) {
    console.log('Patient not found');
    await AppDataSource.destroy();
    return;
  }
  const patientId = patients[0].id;
  console.log('patientId:', patientId);

  // Get doctor id
  const doctors = await AppDataSource.query(
    "SELECT id FROM doctors WHERE email = 'fernando.luckesi.dr@gmail.com' LIMIT 1",
  );
  const doctorId = doctors.length > 0 ? doctors[0].id : null;
  console.log('doctorId:', doctorId);

  // Allergies
  await AppDataSource.query(
    "INSERT INTO patient_allergies (id, patientId, name, severity, reaction, createdAt) VALUES (UUID(), ?, 'Penicilina', 'severe', 'Urticaria e inchaco facial', NOW())",
    [patientId],
  );
  await AppDataSource.query(
    "INSERT INTO patient_allergies (id, patientId, name, severity, reaction, createdAt) VALUES (UUID(), ?, 'Dipirona', 'moderate', 'Manchas vermelhas na pele', NOW())",
    [patientId],
  );
  await AppDataSource.query(
    "INSERT INTO patient_allergies (id, patientId, name, severity, reaction, createdAt) VALUES (UUID(), ?, 'Poeira', 'mild', 'Espirros e congestao nasal', NOW())",
    [patientId],
  );
  console.log('Allergies: 3');

  // Vaccines
  await AppDataSource.query(
    "INSERT INTO patient_vaccines (id, patientId, name, dose, applicationDate, laboratory, createdAt) VALUES (UUID(), ?, 'COVID-19 Pfizer', '3a dose', '2024-03-15', 'Pfizer/BioNTech', NOW())",
    [patientId],
  );
  await AppDataSource.query(
    "INSERT INTO patient_vaccines (id, patientId, name, dose, applicationDate, laboratory, createdAt) VALUES (UUID(), ?, 'Influenza 2024', 'Dose unica', '2024-05-10', 'Butantan', NOW())",
    [patientId],
  );
  await AppDataSource.query(
    "INSERT INTO patient_vaccines (id, patientId, name, dose, applicationDate, laboratory, createdAt) VALUES (UUID(), ?, 'Hepatite B', '3a dose', '2023-08-20', 'Fiocruz', NOW())",
    [patientId],
  );
  await AppDataSource.query(
    "INSERT INTO patient_vaccines (id, patientId, name, dose, applicationDate, laboratory, createdAt) VALUES (UUID(), ?, 'Febre Amarela', 'Dose unica', '2022-01-12', 'Bio-Manguinhos', NOW())",
    [patientId],
  );
  console.log('Vaccines: 4');

  // Diseases
  await AppDataSource.query(
    "INSERT INTO patient_diseases (id, patientId, name, status, description, createdAt, updatedAt) VALUES (UUID(), ?, 'Hipertensao Arterial', 'in_treatment', 'Pressao arterial controlada com medicacao', NOW(), NOW())",
    [patientId],
  );
  await AppDataSource.query(
    "INSERT INTO patient_diseases (id, patientId, name, status, description, createdAt, updatedAt) VALUES (UUID(), ?, 'Rinite Alergica', 'in_treatment', 'Crises sazonais controladas', NOW(), NOW())",
    [patientId],
  );
  console.log('Diseases: 2');

  // Appointments
  if (doctorId) {
    await AppDataSource.query(
      "INSERT INTO appointments (id, patientId, doctorId, dateTime, reason, doctorName, doctorCrm, doctorSpecialty, isCompleted, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, '2025-06-20 10:00:00', 'Dor de cabeca persistente', 'Dr. Fernando Luckesi', '12345/SP', 'Clinica Geral', 1, 'completed', NOW(), NOW())",
      [patientId, doctorId],
    );
    await AppDataSource.query(
      "INSERT INTO appointments (id, patientId, doctorId, dateTime, reason, doctorName, doctorCrm, doctorSpecialty, isCompleted, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, '2025-07-05 14:30:00', 'Tosse seca e febre baixa', 'Dr. Fernando Luckesi', '12345/SP', 'Clinica Geral', 1, 'completed', NOW(), NOW())",
      [patientId, doctorId],
    );
    await AppDataSource.query(
      "INSERT INTO appointments (id, patientId, doctorId, dateTime, reason, doctorName, doctorCrm, doctorSpecialty, isCompleted, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, '2025-08-25 09:00:00', 'Check-up semestral', 'Dr. Fernando Luckesi', '12345/SP', 'Clinica Geral', 0, 'approved', NOW(), NOW())",
      [patientId, doctorId],
    );
    await AppDataSource.query(
      "INSERT INTO appointments (id, patientId, doctorId, dateTime, reason, doctorName, doctorCrm, doctorSpecialty, isCompleted, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, '2025-09-10 11:00:00', 'Retorno cardiologico', 'Dr. Fernando Luckesi', '12345/SP', 'Clinica Geral', 0, 'pending', NOW(), NOW())",
      [patientId, doctorId],
    );
    console.log('Appointments: 4');
  }

  // Medications
  await AppDataSource.query(
    "INSERT INTO medications (id, patientId, doctorId, name, dosage, frequency, startDate, isActive, isFinished, createdAt, updatedAt) VALUES (UUID(), ?, ?, 'Losartana 50mg', '1 comprimido', 'once_daily', '2024-01-10', 1, 0, NOW(), NOW())",
    [patientId, doctorId],
  );
  await AppDataSource.query(
    "INSERT INTO medications (id, patientId, doctorId, name, dosage, frequency, startDate, isActive, isFinished, createdAt, updatedAt) VALUES (UUID(), ?, ?, 'Loratadina 10mg', '1 comprimido', 'once_daily', '2024-06-01', 1, 0, NOW(), NOW())",
    [patientId, doctorId],
  );
  await AppDataSource.query(
    "INSERT INTO medications (id, patientId, doctorId, name, dosage, frequency, startDate, endDate, isActive, isFinished, createdAt, updatedAt) VALUES (UUID(), ?, ?, 'Amoxicilina 500mg', '1 capsula', 'three_times_daily', '2025-07-01', '2025-07-10', 0, 1, NOW(), NOW())",
    [patientId, doctorId],
  );
  console.log('Medications: 3');

  // Exams
  await AppDataSource.query(
    "INSERT INTO exams (id, patientId, doctorId, name, type, scheduledDate, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, 'Hemograma Completo', 'blood_test', '2025-06-25', 'completed', NOW(), NOW())",
    [patientId, doctorId],
  );
  await AppDataSource.query(
    "INSERT INTO exams (id, patientId, doctorId, name, type, scheduledDate, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, 'Glicemia em Jejum', 'blood_test', '2025-06-25', 'completed', NOW(), NOW())",
    [patientId, doctorId],
  );
  await AppDataSource.query(
    "INSERT INTO exams (id, patientId, doctorId, name, type, scheduledDate, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, 'Eletrocardiograma', 'ecg', '2025-07-10', 'completed', NOW(), NOW())",
    [patientId, doctorId],
  );
  await AppDataSource.query(
    "INSERT INTO exams (id, patientId, doctorId, name, type, scheduledDate, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, 'Raio-X Torax', 'xray', '2025-09-01', 'pending', NOW(), NOW())",
    [patientId, doctorId],
  );
  await AppDataSource.query(
    "INSERT INTO exams (id, patientId, doctorId, name, type, scheduledDate, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, 'Ultrassom Abdominal', 'ultrasound', '2025-09-15', 'pending', NOW(), NOW())",
    [patientId, doctorId],
  );
  console.log('Exams: 5');

  await AppDataSource.destroy();
  console.log('All done!');
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
