import 'reflect-metadata';
import 'dotenv/config';

const API = 'http://localhost:3000';

async function req(path: string, opts: { method?: string; body?: any; token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${path}`, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  return res.json();
}

async function main() {
  // Login as Fernando (doctor)
  const dr = await req('/auth/login', { method: 'POST', body: { email: 'fernando.luckesi.dr@gmail.com', password: '958969' } });
  const drToken = dr.token;
  console.log('Doctor logged in:', dr.user.name);

  const patients = [
    { email: 'ana.clara@email.com', password: '123456' },
    { email: 'roberto.santos2@email.com', password: '123456' },
    { email: 'maria.heloisa@email.com', password: '123456' },
    { email: 'carlos.lima@email.com', password: '123456' },
    { email: 'beatriz.mendes@email.com', password: '123456' },
  ];

  for (const p of patients) {
    const patLogin = await req('/auth/login', { method: 'POST', body: p });
    if (!patLogin.token) { console.log(`  ✗ ${p.email} - login failed`); continue; }
    const patientId = patLogin.user.id;
    const patToken = patLogin.token;
    console.log(`\nPatient: ${patLogin.user.name} (${patientId})`);

    // Doctor requests access
    const accessReq = await req('/doctors/access-requests', { method: 'POST', token: drToken, body: { patientId } });
    const requestId = accessReq.id;
    if (!requestId) { console.log('  ✗ Access request failed:', accessReq.message || accessReq); continue; }
    console.log(`  → Request: ${requestId}`);

    // Patient approves
    const approve = await req(`/doctors/access-requests/${requestId}/respond`, { method: 'POST', token: patToken, body: { status: 'approved' } });
    console.log(`  ✓ Approved`);
  }

  // Now create data for all patients
  console.log('\n\n📋 Creating data for all patients...');

  // Re-login to refresh
  const dr2 = await req('/auth/login', { method: 'POST', body: { email: 'fernando.luckesi.dr@gmail.com', password: '958969' } });
  const token = dr2.token;

  // Get all accessible patients
  const myPatients = await req('/patients/my', { token });
  console.log(`Found ${myPatients.length} accessible patients`);

  for (let i = 0; i < myPatients.length; i++) {
    const pid = myPatients[i].id;
    const pname = myPatients[i].name;
    console.log(`\n  Creating data for ${pname}...`);

    // Consultations
    const now = new Date();
    for (let j = 0; j < 3; j++) {
      const d = new Date(now);
      d.setDate(d.getDate() + (j * 3) - 5);
      d.setHours(8 + j * 2, 0, 0);
      await req(`/patients/${pid}/consultations`, { method: 'POST', token, body: {
        date: d.toISOString(),
        symptoms: ['Check-up geral', 'Dor de cabeça recorrente', 'Controle de pressão', 'Revisão de exames', 'Acompanhamento'][j % 5],
        completed: j === 0,
        diagnosis: j === 0 ? 'Paciente estável' : undefined,
        prescription: j === 0 ? 'Manter medicação' : undefined,
      }});
    }
    console.log(`    ✓ 3 consultas`);

    // Medications
    const meds = [
      { name: 'Losartana', dosage: '50mg', frequency: 'daily', startDate: '2026-01-15' },
      { name: 'AAS', dosage: '100mg', frequency: 'daily', startDate: '2026-03-01' },
    ];
    for (const med of meds.slice(0, i % 2 + 1)) {
      await req(`/patients/${pid}/medications`, { method: 'POST', token, body: med });
    }
    console.log(`    ✓ ${Math.min(i % 2 + 1, 2)} medicamentos`);

    // Diseases
    if (i % 2 === 0) {
      await req(`/patients/${pid}/diseases`, { method: 'POST', token, body: { name: 'Hipertensão Arterial', status: 'in_treatment', diagnosisDate: '2020-05-10' } });
      console.log(`    ✓ 1 doença`);
    }

    // Allergies
    if (i % 3 === 0) {
      await req(`/patients/${pid}/allergies`, { method: 'POST', token, body: { name: 'Dipirona', severity: 'moderate', reaction: 'Urticária' } });
      console.log(`    ✓ 1 alergia`);
    }

    // Vaccines
    await req(`/patients/${pid}/vaccines`, { method: 'POST', token, body: { name: 'Influenza 2026', dose: 'Dose única', applicationDate: '2026-04-15', laboratory: 'Butantan' } });
    console.log(`    ✓ 1 vacina`);
  }

  console.log('\n\n✅ Seed completo! Todos os pacientes têm dados.');
}

main().catch(console.error);
