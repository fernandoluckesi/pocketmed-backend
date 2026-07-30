/**
 * Full data seed script - creates users, clinic, patients and all medical data
 * Run with: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-full-data.ts
 */

import 'reflect-metadata';
import 'dotenv/config';
import AppDataSource from '../data-source';

const API_URL = 'http://localhost:3000';

async function request(path: string, options: { method?: string; body?: any; token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();
  if (!res.ok && res.status !== 409) {
    console.error(`❌ ${options.method || 'GET'} ${path}:`, data.message || data);
  }
  return data;
}

async function main() {
  console.log('🚀 Starting full data seed...\n');

  // 1. Register a doctor
  console.log('👨‍⚕️ Creating doctor...');
  const doctorRes = await request('/auth/register/doctor', {
    method: 'POST',
    body: {
      name: 'Dr. Lucas Andrade',
      email: 'lucas.andrade@pocketmed.com',
      password: '123456',
      gender: 'Masculino',
      specialty: 'Cardiologia',
      cpf: '12345678901',
      phone: '11987654321',
      birthDate: '1980-05-15',
      crm: '123456/SP',
    },
  });
  const doctorToken = doctorRes.token;
  const doctorUser = doctorRes.user;
  console.log(`   Doctor: ${doctorUser?.name || 'already exists'}`);

  // Login as existing doctor if registration failed (409)
  let drToken = doctorToken;
  if (!drToken) {
    const login = await request('/auth/login', { method: 'POST', body: { email: 'lucas.andrade@pocketmed.com', password: '123456' } });
    drToken = login.token;
  }

  // Also get Fernando's token
  const fernandoLogin = await request('/auth/login', { method: 'POST', body: { email: 'fernando.luckesi.dr@gmail.com', password: '958969' } });
  const fernandoToken = fernandoLogin.token;
  const fernandoUser = fernandoLogin.user;

  // 2. Register patients
  console.log('\n👤 Creating patients...');
  const patients = [
    { name: 'Ana Clara Oliveira', email: 'ana.clara@email.com', gender: 'female', phone: '11911111111', birthDate: '1990-03-12' },
    { name: 'Roberto Santos', email: 'roberto.santos2@email.com', gender: 'male', phone: '11922222222', birthDate: '1975-08-25' },
    { name: 'Maria Heloísa Silva', email: 'maria.heloisa@email.com', gender: 'female', phone: '11933333333', birthDate: '1988-11-30' },
    { name: 'Carlos Eduardo Lima', email: 'carlos.lima@email.com', gender: 'male', phone: '11944444444', birthDate: '1965-01-20' },
    { name: 'Beatriz Mendes', email: 'beatriz.mendes@email.com', gender: 'female', phone: '11955555555', birthDate: '1995-07-08' },
  ];

  const patientIds: string[] = [];
  for (const p of patients) {
    const res = await request('/auth/register/patient', {
      method: 'POST',
      body: { ...p, password: '123456' },
    });
    if (res.user?.id) {
      patientIds.push(res.user.id);
      console.log(`   ✓ ${p.name}`);
    } else {
      // Try to find existing
      const login = await request('/auth/login', { method: 'POST', body: { email: p.email, password: '123456' } });
      if (login.user?.id) {
        patientIds.push(login.user.id);
        console.log(`   ✓ ${p.name} (existing)`);
      }
    }
  }

  // Also use maria.silva from before
  const mariaLogin = await request('/auth/login', { method: 'POST', body: { email: 'maria.silva@email.com', password: '958969' } });
  if (mariaLogin.user?.id) patientIds.push(mariaLogin.user.id);

  // 3. Create shadow patients for Fernando
  console.log('\n👻 Creating shadow patients for Fernando...');
  const shadowPatients = [
    { name: 'José Ferreira Neto', email: 'jose.neto@email.com', gender: 'male', phone: '11966666666', birthDate: '1955-04-10' },
    { name: 'Lucia Aparecida Gomes', email: 'lucia.gomes@email.com', gender: 'female', phone: '11977777777', birthDate: '1970-12-05' },
  ];

  for (const p of shadowPatients) {
    await request('/auth/register/patient-shadow', {
      method: 'POST',
      token: fernandoToken,
      body: { ...p, doctorCreatorId: fernandoUser.id },
    });
    console.log(`   ✓ ${p.name} (shadow)`);
  }

  // 4. Create appointments (consultations) for Fernando's patients
  console.log('\n📋 Creating consultations...');
  const now = new Date();
  const patientId = patientIds[0]; // Ana Clara

  // Today's appointments
  for (let i = 0; i < 5; i++) {
    const hour = 8 + i * 2;
    const dateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0).toISOString();
    await request(`/patients/${patientIds[i % patientIds.length]}/consultations`, {
      method: 'POST',
      token: fernandoToken,
      body: {
        date: dateTime,
        symptoms: ['Check-up Geral', 'Dor no peito', 'Retorno de exames', 'Consulta de rotina', 'Avaliação cardíaca'][i],
        completed: i < 3, // First 3 completed
      },
    });
    console.log(`   ✓ Consulta ${i + 1} hoje (${hour}:00)`);
  }

  // Future appointments
  for (let i = 1; i <= 8; i++) {
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + i * 2);
    futureDate.setHours(9 + (i % 4) * 2, 0, 0);
    await request(`/patients/${patientIds[i % patientIds.length]}/consultations`, {
      method: 'POST',
      token: fernandoToken,
      body: {
        date: futureDate.toISOString(),
        symptoms: ['Acompanhamento', 'Retorno', 'Check-up', 'Exame de rotina', 'Consulta preventiva', 'Avaliação', 'Revisão de medicamentos', 'Controle'][i - 1],
      },
    });
    console.log(`   ✓ Consulta futura +${i * 2} dias`);
  }

  // Past/cancelled appointments
  for (let i = 1; i <= 3; i++) {
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - i * 7);
    pastDate.setHours(10, 0, 0);
    await request(`/patients/${patientIds[i % patientIds.length]}/consultations`, {
      method: 'POST',
      token: fernandoToken,
      body: {
        date: pastDate.toISOString(),
        symptoms: 'Consulta anterior',
        completed: true,
        diagnosis: 'Paciente estável',
        prescription: 'Manter medicação atual',
      },
    });
    console.log(`   ✓ Consulta passada -${i * 7} dias (concluída)`);
  }

  // 5. Prescribe medications
  console.log('\n💊 Creating medications...');
  const medications = [
    { name: 'Losartana Potássica', dosage: '50mg', frequency: 'daily', startDate: '2026-01-15' },
    { name: 'Metformina', dosage: '850mg', frequency: 'twice_daily', startDate: '2026-02-01' },
    { name: 'Atorvastatina', dosage: '20mg', frequency: 'daily', startDate: '2026-03-10' },
    { name: 'Omeprazol', dosage: '20mg', frequency: 'daily', startDate: '2026-04-01', endDate: '2026-07-01' },
    { name: 'Vitamina D3', dosage: '2000 UI', frequency: 'daily', startDate: '2026-01-01' },
    { name: 'Rivotril', dosage: '0.5mg', frequency: 'daily', startDate: '2026-05-15', notes: 'Tomar à noite antes de dormir' },
  ];

  for (let i = 0; i < medications.length; i++) {
    const pid = patientIds[i % patientIds.length];
    await request(`/patients/${pid}/medications`, {
      method: 'POST',
      token: fernandoToken,
      body: medications[i],
    });
    console.log(`   ✓ ${medications[i].name} para paciente ${i % patientIds.length + 1}`);
  }

  // 6. Create diseases
  console.log('\n🏥 Creating diseases...');
  const diseases = [
    { name: 'Hipertensão Arterial', status: 'in_treatment', diagnosisDate: '2020-03-15', treatmentStartDate: '2020-03-20' },
    { name: 'Diabetes Tipo 2', status: 'in_treatment', diagnosisDate: '2021-06-10', treatmentStartDate: '2021-06-15' },
    { name: 'Asma Brônquica', status: 'cured', diagnosisDate: '2015-01-20', treatmentStartDate: '2015-02-01', treatmentEndDate: '2023-12-01' },
    { name: 'Hipotireoidismo', status: 'in_treatment', diagnosisDate: '2022-09-05', treatmentStartDate: '2022-09-10' },
    { name: 'Artrite Reumatoide', status: 'treatment_suspended', diagnosisDate: '2019-11-20', treatmentStartDate: '2019-12-01' },
  ];

  for (let i = 0; i < diseases.length; i++) {
    const pid = patientIds[i % patientIds.length];
    await request(`/patients/${pid}/diseases`, {
      method: 'POST',
      token: fernandoToken,
      body: diseases[i],
    });
    console.log(`   ✓ ${diseases[i].name}`);
  }

  // 7. Create allergies
  console.log('\n⚠️ Creating allergies...');
  const allergies = [
    { name: 'Penicilina', severity: 'severe', reaction: 'Anafilaxia' },
    { name: 'Ácaros', severity: 'moderate', reaction: 'Rinite alérgica, espirros' },
    { name: 'Dipirona', severity: 'mild', reaction: 'Urticária leve' },
    { name: 'Frutos do mar', severity: 'severe', reaction: 'Edema de glote' },
    { name: 'Latex', severity: 'moderate', reaction: 'Dermatite de contato' },
    { name: 'Ibuprofeno', severity: 'mild', reaction: 'Dor de estômago' },
    { name: 'Contraste iodado', severity: 'severe', reaction: 'Reação anafilactoide' },
  ];

  for (let i = 0; i < allergies.length; i++) {
    const pid = patientIds[i % patientIds.length];
    await request(`/patients/${pid}/allergies`, {
      method: 'POST',
      token: fernandoToken,
      body: allergies[i],
    });
    console.log(`   ✓ ${allergies[i].name} (${allergies[i].severity})`);
  }

  // 8. Create vaccines
  console.log('\n💉 Creating vaccines...');
  const vaccines = [
    { name: 'COVID-19 Pfizer', dose: '3ª dose (reforço)', applicationDate: '2025-03-15', laboratory: 'Pfizer/BioNTech' },
    { name: 'Influenza 2026', dose: 'Dose única', applicationDate: '2026-04-10', laboratory: 'Butantan' },
    { name: 'Hepatite B', dose: '3ª dose', applicationDate: '2024-08-20', laboratory: 'Fiocruz' },
    { name: 'Tétano (dT)', dose: 'Reforço', applicationDate: '2023-11-05', nextDoseDate: '2033-11-05', laboratory: 'Butantan' },
    { name: 'Febre Amarela', dose: 'Dose única', applicationDate: '2022-01-20', laboratory: 'Bio-Manguinhos' },
    { name: 'Pneumocócica 23', dose: '1ª dose', applicationDate: '2026-02-28', nextDoseDate: '2031-02-28', laboratory: 'MSD' },
    { name: 'Herpes Zóster', dose: '1ª dose', applicationDate: '2026-06-15', nextDoseDate: '2026-08-15', laboratory: 'GSK' },
    { name: 'COVID-19 Pfizer', dose: '4ª dose (bivalente)', applicationDate: '2026-05-01', laboratory: 'Pfizer/BioNTech' },
  ];

  for (let i = 0; i < vaccines.length; i++) {
    const pid = patientIds[i % patientIds.length];
    await request(`/patients/${pid}/vaccines`, {
      method: 'POST',
      token: fernandoToken,
      body: vaccines[i],
    });
    console.log(`   ✓ ${vaccines[i].name} (${vaccines[i].dose})`);
  }

  // 9. Create exams
  console.log('\n🔬 Creating exams...');
  const batchId1 = crypto.randomUUID();
  const batchId2 = crypto.randomUUID();

  const exams = [
    { name: 'Hemograma Completo', type: 'blood_test', description: 'Exames de rotina - check-up anual', patientId: patientIds[0], batchId: batchId1 },
    { name: 'Glicose', type: 'blood_test', description: 'Exames de rotina - check-up anual', patientId: patientIds[0], batchId: batchId1 },
    { name: 'Colesterol Total e Frações', type: 'blood_test', description: 'Exames de rotina - check-up anual', patientId: patientIds[0], batchId: batchId1 },
    { name: 'TSH', type: 'blood_test', description: 'Controle de tireoide', patientId: patientIds[1], batchId: batchId2 },
    { name: 'T4 Livre', type: 'blood_test', description: 'Controle de tireoide', patientId: patientIds[1], batchId: batchId2 },
    { name: 'Ecocardiograma', type: 'ultrasound', description: 'Avaliação cardíaca', patientId: patientIds[2] },
    { name: 'Eletrocardiograma', type: 'ecg', description: 'ECG de repouso', patientId: patientIds[3] },
    { name: 'Raio-X Tórax', type: 'xray', description: 'Avaliação pulmonar', patientId: patientIds[4] },
  ];

  for (const exam of exams) {
    await request('/exams', {
      method: 'POST',
      token: fernandoToken,
      body: exam,
    });
    console.log(`   ✓ ${exam.name}`);
  }

  console.log('\n✅ Seed completo! Dados criados com sucesso.');
  console.log(`\n📊 Resumo:`);
  console.log(`   Pacientes: ${patientIds.length}`);
  console.log(`   Consultas: ${5 + 8 + 3} (hoje: 5, futuras: 8, passadas: 3)`);
  console.log(`   Medicamentos: ${medications.length}`);
  console.log(`   Doenças: ${diseases.length}`);
  console.log(`   Alergias: ${allergies.length}`);
  console.log(`   Vacinas: ${vaccines.length}`);
  console.log(`   Exames: ${exams.length}`);
}

main().catch(console.error);
