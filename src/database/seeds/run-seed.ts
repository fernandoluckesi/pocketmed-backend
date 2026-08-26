import 'reflect-metadata';
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import AppDataSource from '../data-source';

/**
 * Seed completo — replica exatamente o seed-full-data.sql em TypeScript.
 * Uso: npm run seed:run
 *
 * Cria: 1 clínica, 10 médicos, 150 pacientes, permissões, consultas,
 * exames, medicamentos, doenças, alergias, vacinas, dependentes.
 *
 * Senha de todos: Fernando958969++
 * Admin: hipocrates@email.com
 */

const PASSWORD = 'Fernando958969++';

const TABLES_TO_CLEAR = [
  'doctor_permissions',
  'doctor_access_requests',
  'appointments',
  'medications',
  'exams',
  'exam_schedules',
  'exam_schedule_items',
  'clinic_memberships',
  'secretary_profiles',
  'clinic_admin_profiles',
  'dependent_responsibles',
  'dependents',
  'patients',
  'doctors',
  'clinics',
  'notifications',
  'device_tokens',
  'patient_access_logs',
  'patient_diseases',
  'patient_allergies',
  'patient_vaccines',
  'doctor_documents',
  'financial_settings',
  'financial_cost_centers',
  'financial_convenios',
  'financial_revenues',
  'financial_expenses',
  'financial_doctor_transfers',
  'financial_cashflow_entries',
  'audit_events',
];

const DOCTORS = [
  {
    name: 'Dr. Hipócrates',
    email: 'hipocrates@email.com',
    gender: 'Masculino',
    phone: '11900000001',
    birthDate: '1975-03-15',
    specialty: 'Clínica Geral',
    crm: '100001/SP',
    cpf: '10000000001',
  },
  {
    name: 'Dra. Helena Cardoso',
    email: 'helena.cardoso@email.com',
    gender: 'Feminino',
    phone: '11900000002',
    birthDate: '1980-07-22',
    specialty: 'Cardiologia',
    crm: '100002/SP',
    cpf: '10000000002',
  },
  {
    name: 'Dr. Ricardo Mendes',
    email: 'ricardo.mendes@email.com',
    gender: 'Masculino',
    phone: '11900000003',
    birthDate: '1978-11-10',
    specialty: 'Neurologia',
    crm: '100003/SP',
    cpf: '10000000003',
  },
  {
    name: 'Dra. Camila Ferreira',
    email: 'camila.ferreira@email.com',
    gender: 'Feminino',
    phone: '11900000004',
    birthDate: '1982-04-05',
    specialty: 'Pediatria',
    crm: '100004/SP',
    cpf: '10000000004',
  },
  {
    name: 'Dr. André Oliveira',
    email: 'andre.oliveira@email.com',
    gender: 'Masculino',
    phone: '11900000005',
    birthDate: '1976-09-18',
    specialty: 'Ortopedia',
    crm: '100005/SP',
    cpf: '10000000005',
  },
  {
    name: 'Dra. Juliana Costa',
    email: 'juliana.costa@email.com',
    gender: 'Feminino',
    phone: '11900000006',
    birthDate: '1984-01-30',
    specialty: 'Dermatologia',
    crm: '100006/SP',
    cpf: '10000000006',
  },
  {
    name: 'Dr. Marcos Pereira',
    email: 'marcos.pereira@email.com',
    gender: 'Masculino',
    phone: '11900000007',
    birthDate: '1979-06-12',
    specialty: 'Endocrinologia',
    crm: '100007/SP',
    cpf: '10000000007',
  },
  {
    name: 'Dra. Fernanda Lima',
    email: 'fernanda.lima@email.com',
    gender: 'Feminino',
    phone: '11900000008',
    birthDate: '1981-08-25',
    specialty: 'Ginecologia',
    crm: '100008/SP',
    cpf: '10000000008',
  },
  {
    name: 'Dr. Lucas Ribeiro',
    email: 'lucas.ribeiro@email.com',
    gender: 'Masculino',
    phone: '11900000009',
    birthDate: '1983-12-03',
    specialty: 'Pneumologia',
    crm: '100009/SP',
    cpf: '10000000009',
  },
  {
    name: 'Dra. Beatriz Santos',
    email: 'beatriz.santos@email.com',
    gender: 'Feminino',
    phone: '11900000010',
    birthDate: '1985-02-14',
    specialty: 'Oftalmologia',
    crm: '100010/SP',
    cpf: '10000000010',
  },
];

const FIRST_NAMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Fabio',
  'Gabriela',
  'Henrique',
  'Isabela',
  'João',
  'Karen',
  'Leonardo',
  'Mariana',
  'Nicolas',
  'Olivia',
  'Paulo',
  'Rafaela',
  'Samuel',
  'Tatiana',
  'Ulisses',
  'Valentina',
  'Wesley',
  'Ximena',
  'Yuri',
  'Zilda',
];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Ferreira', 'Almeida'];

function getPatientName(i: number): string {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
}

function getPatientBirth(i: number): string {
  const base = new Date('1970-01-01');
  base.setDate(base.getDate() + i * 73);
  return base.toISOString().split('T')[0];
}

async function run() {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  PocketMed — Seed Completo (TypeScript)');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();

  // ── 1. LIMPAR BANCO ──
  console.log('🗑️  Limpando banco...');
  await qr.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES_TO_CLEAR) {
    try {
      await qr.query(`DELETE FROM \`${table}\``);
    } catch {
      /* skip */
    }
  }
  await qr.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('   ✓ Banco limpo');

  // ── 2. HASH DA SENHA ──
  const pwd = await bcrypt.hash(PASSWORD, 10);

  // ── 3. CLÍNICA ──
  console.log('🏥 Criando clínica...');
  await qr.query(
    `INSERT INTO clinics (id, name, cnpj, isActive, city, state, createdAt, updatedAt) VALUES (UUID(), 'Clínica Hipócrates', '12345678000199', 1, 'São Paulo', 'SP', NOW(), NOW())`,
  );
  const clinicRows = await qr.query(`SELECT id FROM clinics LIMIT 1`);
  const clinicId = clinicRows[0].id;
  console.log(`   ✓ Clínica: ${clinicId}`);

  // ── 4. MÉDICOS ──
  console.log('👨‍⚕️ Criando 10 médicos...');
  const doctorIds: string[] = [];

  for (const doc of DOCTORS) {
    await qr.query(
      `INSERT INTO doctors (id, name, email, password, gender, phone, birthDate, specialty, crm, cpf, type, isShadow, emailVerified, verificationStatus, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'doctor', 0, 1, 'APPROVED', NOW(), NOW())`,
      [
        doc.name,
        doc.email,
        pwd,
        doc.gender,
        doc.phone,
        doc.birthDate,
        doc.specialty,
        doc.crm,
        doc.cpf,
      ],
    );
    const docRows = await qr.query(`SELECT id FROM doctors WHERE email = ? LIMIT 1`, [doc.email]);
    doctorIds.push(docRows[0].id);
  }
  console.log(`   ✓ ${doctorIds.length} médicos criados`);

  // ── 5. MEMBROS DA CLÍNICA ──
  console.log('🔗 Criando memberships...');
  for (let i = 0; i < doctorIds.length; i++) {
    const role = i === 0 ? 'admin' : 'doctor';
    const invitedBy = i === 0 ? null : doctorIds[0];
    await qr.query(
      `INSERT INTO clinic_memberships (id, clinicId, professionalId, role, isActive, invitedBy, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, 1, ?, NOW(), NOW())`,
      [clinicId, doctorIds[i], role, invitedBy],
    );
  }
  console.log('   ✓ Memberships criadas');

  // ── 6. PACIENTES (150) ──
  console.log('🧑‍🤝‍🧑 Criando 150 pacientes...');
  const patientIds: string[] = [];

  for (let i = 1; i <= 150; i++) {
    const name = getPatientName(i);
    const email = `paciente${i}@email.com`;
    const gender = i % 2 === 0 ? 'Feminino' : 'Masculino';
    const phone = `1198${String(i).padStart(7, '0')}`;
    const birth = getPatientBirth(i);

    await qr.query(
      `INSERT INTO patients (id, name, email, password, gender, phone, birthDate, type, isShadow, emailVerified, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, ?, ?, ?, 'patient', 0, 1, NOW(), NOW())`,
      [name, email, pwd, gender, phone, birth],
    );
    const patRows = await qr.query(`SELECT id FROM patients WHERE email = ? LIMIT 1`, [email]);
    patientIds.push(patRows[0].id);
  }
  console.log(`   ✓ ${patientIds.length} pacientes criados`);

  // ── 7. PERMISSÕES ──
  // Pacientes 1-20: doc1, 21-30: doc2, 31-40: doc3, 41-50: doc4, 51-60: doc5
  // 61-70: doc6, 71-80: doc7, 81-90: doc8, 91-100: doc9, 101-110: doc10
  // 111-150: sem permissão
  console.log('🔑 Criando permissões...');
  let permCount = 0;

  for (let i = 0; i < 120; i++) {
    let docIdx: number;
    if (i < 20) docIdx = 0;
    else if (i < 30) docIdx = 1;
    else if (i < 40) docIdx = 2;
    else if (i < 50) docIdx = 3;
    else if (i < 60) docIdx = 4;
    else if (i < 70) docIdx = 5;
    else if (i < 80) docIdx = 6;
    else if (i < 90) docIdx = 7;
    else if (i < 100) docIdx = 8;
    else docIdx = 9;

    await qr.query(
      `INSERT INTO doctor_permissions (id, doctorId, patientId, isActive, grantedAt) VALUES (UUID(), ?, ?, 1, NOW())`,
      [doctorIds[docIdx], patientIds[i]],
    );
    permCount++;
  }
  console.log(`   ✓ ${permCount} permissões`);

  // ── 8. CONSULTAS (3 por paciente, primeiros 50) ──
  console.log('📅 Criando consultas...');
  let aptCount = 0;

  for (let i = 0; i < 50; i++) {
    let docIdx: number;
    if (i < 20) docIdx = 0;
    else if (i < 30) docIdx = 1;
    else if (i < 40) docIdx = 2;
    else docIdx = 3;

    const doc = DOCTORS[docIdx];
    const dId = doctorIds[docIdx];
    const pId = patientIds[i];

    // Consulta passada concluída
    await qr.query(
      `INSERT INTO appointments (id, doctorId, patientId, doctorName, doctorCrm, doctorSpecialty, reason, dateTime, isCompleted, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, ?, ?, 'Consulta de rotina', DATE_SUB(NOW(), INTERVAL ? DAY), 1, 'completed', NOW(), NOW())`,
      [dId, pId, doc.name, doc.crm, doc.specialty, 90 + i],
    );
    // Retorno passado concluído
    await qr.query(
      `INSERT INTO appointments (id, doctorId, patientId, doctorName, doctorCrm, doctorSpecialty, reason, dateTime, isCompleted, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, ?, ?, 'Retorno', DATE_SUB(NOW(), INTERVAL ? DAY), 1, 'completed', NOW(), NOW())`,
      [dId, pId, doc.name, doc.crm, doc.specialty, 30 + i],
    );
    // Consulta futura agendada
    await qr.query(
      `INSERT INTO appointments (id, doctorId, patientId, doctorName, doctorCrm, doctorSpecialty, reason, dateTime, isCompleted, status, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, ?, ?, 'Acompanhamento', DATE_ADD(NOW(), INTERVAL ? DAY), 0, 'approved', NOW(), NOW())`,
      [dId, pId, doc.name, doc.crm, doc.specialty, i * 2],
    );
    aptCount += 3;
  }
  console.log(`   ✓ ${aptCount} consultas`);

  // ── 9. EXAMES (3 por paciente, primeiros 40) ──
  console.log('🔬 Criando exames...');
  let examCount = 0;

  for (let i = 0; i < 40; i++) {
    const dId = doctorIds[0]; // Hipócrates
    const pId = patientIds[i];

    await qr.query(
      `INSERT INTO exams (id, name, type, description, scheduledDate, status, laboratory, doctorId, patientId, createdAt, updatedAt) VALUES (UUID(), 'Hemograma Completo', 'blood_test', 'Exame de sangue de rotina', DATE_SUB(CURDATE(), INTERVAL ? DAY), 'completed', 'Lab São Paulo', ?, ?, NOW(), NOW())`,
      [60 + i, dId, pId],
    );
    await qr.query(
      `INSERT INTO exams (id, name, type, description, scheduledDate, status, laboratory, doctorId, patientId, createdAt, updatedAt) VALUES (UUID(), 'Glicose em Jejum', 'blood_test', 'Controle glicêmico', DATE_SUB(CURDATE(), INTERVAL ? DAY), 'completed', 'Lab São Paulo', ?, ?, NOW(), NOW())`,
      [30 + i, dId, pId],
    );
    await qr.query(
      `INSERT INTO exams (id, name, type, description, scheduledDate, status, laboratory, doctorId, patientId, createdAt, updatedAt) VALUES (UUID(), 'Ultrassonografia Abdominal', 'ultrasound', 'Avaliação abdominal', DATE_ADD(CURDATE(), INTERVAL ? DAY), 'scheduled', 'Clínica Imagem', ?, ?, NOW(), NOW())`,
      [i * 3, dId, pId],
    );
    examCount += 3;
  }
  console.log(`   ✓ ${examCount} exames`);

  // ── 10. MEDICAMENTOS (3 por paciente, primeiros 30) ──
  console.log('💊 Criando medicamentos...');
  let medCount = 0;

  for (let i = 0; i < 30; i++) {
    const dId = doctorIds[0];
    const pId = patientIds[i];

    await qr.query(
      `INSERT INTO medications (id, name, dosage, frequency, times, startDate, isActive, isFinished, doctorId, patientId, createdAt, updatedAt) VALUES (UUID(), 'Losartana 50mg', '1 comprimido', 'once_daily', '["08:00"]', CURDATE(), 1, 0, ?, ?, NOW(), NOW())`,
      [dId, pId],
    );
    await qr.query(
      `INSERT INTO medications (id, name, dosage, frequency, times, startDate, isActive, isFinished, doctorId, patientId, createdAt, updatedAt) VALUES (UUID(), 'Metformina 850mg', '1 comprimido', 'twice_daily', '["08:00","20:00"]', CURDATE(), 1, 0, ?, ?, NOW(), NOW())`,
      [dId, pId],
    );
    await qr.query(
      `INSERT INTO medications (id, name, dosage, frequency, times, startDate, isActive, isFinished, doctorId, patientId, createdAt, updatedAt) VALUES (UUID(), 'Omeprazol 20mg', '1 cápsula', 'once_daily', '["07:00"]', DATE_SUB(CURDATE(), INTERVAL 30 DAY), 0, 1, ?, ?, NOW(), NOW())`,
      [dId, pId],
    );
    medCount += 3;
  }
  console.log(`   ✓ ${medCount} medicamentos`);

  // ── 11. DOENÇAS (3 por paciente, primeiros 25) ──
  console.log('🩺 Criando doenças...');
  let diseaseCount = 0;

  for (let i = 0; i < 25; i++) {
    const dId = doctorIds[0];
    const pId = patientIds[i];

    await qr.query(
      `INSERT INTO patient_diseases (id, name, status, diagnosisDate, patientId, doctorId, createdAt, updatedAt) VALUES (UUID(), 'Hipertensão Arterial', 'in_treatment', DATE_SUB(CURDATE(), INTERVAL 365 DAY), ?, ?, NOW(), NOW())`,
      [pId, dId],
    );
    await qr.query(
      `INSERT INTO patient_diseases (id, name, status, diagnosisDate, patientId, doctorId, createdAt, updatedAt) VALUES (UUID(), 'Diabetes Tipo 2', 'in_treatment', DATE_SUB(CURDATE(), INTERVAL 200 DAY), ?, ?, NOW(), NOW())`,
      [pId, dId],
    );
    await qr.query(
      `INSERT INTO patient_diseases (id, name, status, diagnosisDate, patientId, doctorId, createdAt, updatedAt) VALUES (UUID(), 'Hipotireoidismo', 'in_treatment', DATE_SUB(CURDATE(), INTERVAL 100 DAY), ?, ?, NOW(), NOW())`,
      [pId, dId],
    );
    diseaseCount += 3;
  }
  console.log(`   ✓ ${diseaseCount} doenças`);

  // ── 12. ALERGIAS (3 por paciente, primeiros 20) ──
  console.log('⚠️  Criando alergias...');
  let allergyCount = 0;

  for (let i = 0; i < 20; i++) {
    const dId = doctorIds[0];
    const pId = patientIds[i];

    await qr.query(
      `INSERT INTO patient_allergies (id, name, severity, reaction, patientId, doctorId, createdAt) VALUES (UUID(), 'Dipirona', 'severe', 'Edema de glote', ?, ?, NOW())`,
      [pId, dId],
    );
    await qr.query(
      `INSERT INTO patient_allergies (id, name, severity, reaction, patientId, doctorId, createdAt) VALUES (UUID(), 'Penicilina', 'moderate', 'Urticária generalizada', ?, ?, NOW())`,
      [pId, dId],
    );
    await qr.query(
      `INSERT INTO patient_allergies (id, name, severity, reaction, patientId, doctorId, createdAt) VALUES (UUID(), 'Frutos do mar', 'mild', 'Coceira leve', ?, ?, NOW())`,
      [pId, dId],
    );
    allergyCount += 3;
  }
  console.log(`   ✓ ${allergyCount} alergias`);

  // ── 13. VACINAS (3 por paciente, primeiros 20) ──
  console.log('💉 Criando vacinas...');
  let vaccineCount = 0;

  for (let i = 0; i < 20; i++) {
    const dId = doctorIds[0];
    const pId = patientIds[i];

    await qr.query(
      `INSERT INTO patient_vaccines (id, name, dose, applicationDate, laboratory, patientId, doctorId, createdAt) VALUES (UUID(), 'COVID-19 Pfizer', '3ª dose', '2024-03-15', 'Pfizer/BioNTech', ?, ?, NOW())`,
      [pId, dId],
    );
    await qr.query(
      `INSERT INTO patient_vaccines (id, name, dose, applicationDate, laboratory, patientId, doctorId, createdAt) VALUES (UUID(), 'Influenza 2024', 'Dose única', '2024-04-20', 'Butantan', ?, ?, NOW())`,
      [pId, dId],
    );
    await qr.query(
      `INSERT INTO patient_vaccines (id, name, dose, applicationDate, laboratory, patientId, doctorId, createdAt) VALUES (UUID(), 'Hepatite B', '3ª dose', '2023-08-10', 'Fiocruz', ?, ?, NOW())`,
      [pId, dId],
    );
    vaccineCount += 3;
  }
  console.log(`   ✓ ${vaccineCount} vacinas`);

  // ── 14. DEPENDENTES (10 pacientes terão dependentes) ──
  console.log('👶 Criando dependentes...');
  let depCount = 0;

  for (let i = 0; i < 10; i++) {
    const pId = patientIds[i];
    const depName = `Dependente de Pac ${i + 1}`;
    const depGender = i % 2 === 0 ? 'Feminino' : 'Masculino';
    const depBirth = new Date();
    depBirth.setDate(depBirth.getDate() - (i * 365 + 1000));
    const depBirthStr = depBirth.toISOString().split('T')[0];

    await qr.query(
      `INSERT INTO dependents (id, name, gender, type, birthDate, adminResponsibleId, createdAt, updatedAt) VALUES (UUID(), ?, ?, 'filho', ?, ?, NOW(), NOW())`,
      [depName, depGender, depBirthStr, pId],
    );
    const depRows = await qr.query(
      `SELECT id FROM dependents WHERE adminResponsibleId = ? ORDER BY createdAt DESC LIMIT 1`,
      [pId],
    );
    const depId = depRows[0].id;
    await qr.query(`INSERT INTO dependent_responsibles (dependentId, patientId) VALUES (?, ?)`, [
      depId,
      pId,
    ]);
    depCount++;
  }
  console.log(`   ✓ ${depCount} dependentes`);

  await qr.release();

  // ── RESUMO ──
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  ✅ Seed finalizado!');
  console.log('═══════════════════════════════════════════════');
  console.log(`  🏥 Clínica:      1 (Clínica Hipócrates)`);
  console.log(`  👨‍⚕️ Médicos:      ${doctorIds.length}`);
  console.log(`  🧑‍🤝‍🧑 Pacientes:    ${patientIds.length}`);
  console.log(`  🔑 Permissões:   ${permCount}`);
  console.log(`  📅 Consultas:    ${aptCount}`);
  console.log(`  🔬 Exames:       ${examCount}`);
  console.log(`  💊 Medicamentos: ${medCount}`);
  console.log(`  🩺 Doenças:      ${diseaseCount}`);
  console.log(`  ⚠️  Alergias:     ${allergyCount}`);
  console.log(`  💉 Vacinas:      ${vaccineCount}`);
  console.log(`  👶 Dependentes:  ${depCount}`);
  console.log('');
  console.log('  Login: hipocrates@email.com / Fernando958969++');
  console.log('  (Todos os emails usam a mesma senha)');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  await AppDataSource.destroy();
}

run().catch(async (error) => {
  console.error('❌ Erro ao executar seed:', error.message || error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
