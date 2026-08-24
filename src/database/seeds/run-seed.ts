import 'reflect-metadata';
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import AppDataSource from '../data-source';
import { Doctor } from '../../entities/doctor.entity';
import { Patient } from '../../entities/patient.entity';
import { Clinic } from '../../entities/clinic.entity';
import { ClinicMembership } from '../../entities/clinic-membership.entity';
import { DoctorPermission } from '../../entities/doctor-permission.entity';
import { ProfessionalRole } from '../../auth/professional-role.enum';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const ADMIN_EMAIL = 'hipocrates@email.com';
const ADMIN_PASSWORD = 'Fernando958969++';
const ALL_DOCTORS_PASSWORD = 'Fernando958969++';

const CLINIC_DATA = {
  name: 'Policlínica',
  cnpj: '12345678000199',
  cep: '01310-100',
  street: 'Av. Paulista',
  number: '1000',
  complement: 'Conjunto 501',
  neighborhood: 'Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  noNumber: false,
};

const DOCTORS_DATA = [
  {
    name: 'Dra. Camila Ferreira',
    email: 'camila.ferreira@email.com',
    gender: 'Feminino',
    phone: '11999000101',
    birthDate: '1985-03-12',
    specialty: 'Cardiologia',
    crm: '200001/SP',
    cpf: '20000000001',
  },
  {
    name: 'Dr. Rafael Souza',
    email: 'rafael.souza@email.com',
    gender: 'Masculino',
    phone: '11999000102',
    birthDate: '1982-07-25',
    specialty: 'Dermatologia',
    crm: '200002/SP',
    cpf: '20000000002',
  },
  {
    name: 'Dra. Juliana Martins',
    email: 'juliana.martins@email.com',
    gender: 'Feminino',
    phone: '11999000103',
    birthDate: '1990-01-08',
    specialty: 'Pediatria',
    crm: '200003/SP',
    cpf: '20000000003',
  },
  {
    name: 'Dr. Bruno Oliveira',
    email: 'bruno.oliveira@email.com',
    gender: 'Masculino',
    phone: '11999000104',
    birthDate: '1978-11-30',
    specialty: 'Ortopedia e Traumatologia',
    crm: '200004/SP',
    cpf: '20000000004',
  },
  {
    name: 'Dra. Fernanda Lima',
    email: 'fernanda.lima@email.com',
    gender: 'Feminino',
    phone: '11999000105',
    birthDate: '1987-09-14',
    specialty: 'Ginecologia e Obstetrícia',
    crm: '200005/SP',
    cpf: '20000000005',
  },
  {
    name: 'Dr. Marcos Almeida',
    email: 'marcos.almeida@email.com',
    gender: 'Masculino',
    phone: '11999000106',
    birthDate: '1983-04-22',
    specialty: 'Neurologia',
    crm: '200006/SP',
    cpf: '20000000006',
  },
  {
    name: 'Dra. Patrícia Rocha',
    email: 'patricia.rocha@email.com',
    gender: 'Feminino',
    phone: '11999000107',
    birthDate: '1991-12-05',
    specialty: 'Endocrinologia e Metabologia',
    crm: '200007/SP',
    cpf: '20000000007',
  },
  {
    name: 'Dr. Diego Nascimento',
    email: 'diego.nascimento@email.com',
    gender: 'Masculino',
    phone: '11999000108',
    birthDate: '1986-08-18',
    specialty: 'Pneumologia',
    crm: '200008/SP',
    cpf: '20000000008',
  },
  {
    name: 'Dra. Larissa Teixeira',
    email: 'larissa.teixeira@email.com',
    gender: 'Feminino',
    phone: '11999000109',
    birthDate: '1989-05-27',
    specialty: 'Psiquiatria',
    crm: '200009/SP',
    cpf: '20000000009',
  },
  {
    name: 'Dr. Thiago Costa',
    email: 'thiago.costa@email.com',
    gender: 'Masculino',
    phone: '11999000110',
    birthDate: '1984-02-10',
    specialty: 'Urologia',
    crm: '200010/SP',
    cpf: '20000000010',
  },
];

const PATIENT_NAMES = [
  'Maria Silva Santos',
  'João Pedro Oliveira',
  'Ana Carolina Souza',
  'Carlos Eduardo Lima',
  'Fernanda Costa Alves',
  'Ricardo Mendes Ferreira',
  'Patrícia Rodrigues Nunes',
  'Bruno Carvalho Dias',
  'Camila Barbosa Martins',
  'Diego Araújo Pereira',
  'Juliana Nascimento Rocha',
  'Thiago Gomes Ribeiro',
  'Larissa Fernandes Castro',
  'Rafael Santos Correia',
  'Beatriz Moreira Vieira',
  'Lucas Almeida Teixeira',
  'Gabriela Lopes Cardoso',
  'Marcos Vinícius Pinto',
  'Aline Freitas Monteiro',
  'Felipe Ramos Azevedo',
  'Renata Cunha Borges',
  'Gustavo Henrique Melo',
  'Isabela Duarte Campos',
  'Leandro Sousa Medeiros',
  'Vanessa Pires Cavalcanti',
  'Anderson Reis Figueiredo',
  'Tatiana Moura Xavier',
  'Rodrigo Fonseca Barros',
  'Priscila Andrade Rezende',
  'Eduardo Machado Sampaio',
  'Daniela Vasconcelos Cruz',
  'Henrique Batista Leal',
  'Luciana Tavares Brito',
  'Matheus Coelho Guimarães',
  'Simone Pacheco Amaral',
  'Vinícius Nogueira Sales',
  'Amanda Pinheiro Lacerda',
  'Pedro Henrique Siqueira',
  'Raquel Aguiar Coutinho',
  'Fábio Cardoso Miranda',
  'Cristiane Magalhães Assis',
  'Alexandre Bastos Alencar',
  'Elisa Queiroz Faria',
  'Roberto Silveira Lopes',
  'Michele Torres Rangel',
  'Caio Domingues Vargas',
  'Mariana Esteves Paiva',
  'Wagner Bezerra Trindade',
  'Sabrina Matos Serrano',
  'Leonardo Braga Fontenele',
  'Adriana Mendonça Pereira',
  'Sérgio Lemos Andrade',
  'Mônica Farias Campos',
  'Antônio Gomes Pereira',
  'Cláudia Ribas Neves',
  'Paulo César Moraes',
  'Débora Lins Cordeiro',
  'Otávio Rangel Machado',
  'Lúcia Helena Dutra',
  'Rogério Dantas Fonseca',
  'Sandra Maia Bezerra',
  'Márcio Leal Araújo',
  'Viviane Borges Prado',
  'Júlio César Queiroz',
  'Carla Rezende Vieira',
  'Nilton Braga Pacheco',
  'Regina Lacerda Campos',
  'Flávio Santana Nogueira',
  'Valéria Costa Pinto',
  'Hugo Bastos Alencar',
  'Denise Fontes Tavares',
  'Reginaldo Cruz Moreira',
  'Elaine Brito Sampaio',
  'Nelson Martins Souza',
  'Rosana Duarte Alves',
  'Geraldo Teixeira Lins',
  'Sônia Barros Faria',
  'Cássio Monteiro Lima',
  'Tereza Gomes Rocha',
  'Ronaldo Pires Medeiros',
  'Helena Cardoso Neves',
  'Edson Cavalcanti Reis',
  'Luciene Andrade Melo',
  'Valdir Correia Santos',
  'Márcia Dantas Pinheiro',
  'Cléber Fonseca Moura',
  'Joice Almeida Trindade',
  'Raimundo Costa Dias',
  'Célia Ribeiro Xavier',
  'Jorge Nascimento Barros',
  'Shirley Vasconcelos Lima',
  'Wander Guimarães Pinto',
  'Naiara Coelho Ferreira',
  'Davi Machado Oliveira',
  'Selma Tavares Dutra',
  'Laércio Braga Costa',
  'Ivone Araújo Lopes',
  'Tarcísio Freitas Borges',
  'Glória Rezende Martins',
  'Milton Siqueira Campos',
  'Janete Melo Nunes',
  'Erasmo Leal Souza',
  'Neusa Barros Correia',
  'Adilson Pires Gomes',
  'Conceição Moreira Fontes',
  'Benedito Sampaio Rangel',
  'Iracema Dantas Vieira',
  'Osvaldo Queiroz Pereira',
  'Dalva Ferreira Rocha',
  'Arlindo Souza Medeiros',
  'Elza Monteiro Ribeiro',
  'Silvio Andrade Nogueira',
  'Aparecida Lima Castro',
  'Josué Figueiredo Braga',
  'Odete Cavalcanti Melo',
  'Alcides Brito Tavares',
  'Madalena Pinheiro Santos',
  'Domingos Lacerda Reis',
  'Eunice Correia Bastos',
  'Valdomiro Alves Fonseca',
  'Aurora Pacheco Lima',
  'Getúlio Moura Cardoso',
  'Perpétua Nascimento Dias',
  'Anísio Gomes Oliveira',
  'Zilda Rocha Teixeira',
  'Ernesto Vieira Lopes',
  'Teodora Almeida Rangel',
  'Felício Barbosa Cruz',
  'Leonor Freitas Souza',
  'Amaro Martins Araújo',
  'Iolanda Costa Ferreira',
  'Norberto Dutra Pinto',
  'Francisca Leal Borges',
  'Amadeu Correia Vasconcelos',
  'Raimunda Campos Pereira',
  'Juvenal Souza Nogueira',
  'Sebastiana Matos Lima',
  'Aristides Mendes Braga',
  'Clotilde Andrade Sampaio',
  'Hermínio Faria Xavier',
  'Berenice Tavares Lins',
  'Almiro Ribeiro Dantas',
  'Graziela Pires Moreira',
  'Heráclito Cardoso Melo',
  'Olívia Santos Pacheco',
  'Salomão Vieira Rezende',
  'Leocádia Moraes Fontes',
  'Euclides Alves Trindade',
  'Petronília Gomes Dutra',
  'Tibúrcio Nascimento Brito',
  'Norma Costa Leal',
  'Astolfo Reis Machado',
  'Magnólia Souza Alencar',
  'Deoclécio Lima Fonseca',
  'Alzira Martins Cavalcanti',
  'Venâncio Borges Dias',
  'Efigênia Rocha Prado',
  'Bartolomeu Ferreira Queiroz',
  'Hortência Oliveira Medeiros',
  'Plínio Barros Moura',
];

// ============================================================================
// HELPERS
// ============================================================================

function normalizeEmail(name: string): string {
  const parts = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(' ');
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first}.${last}@email.com`;
}

// ============================================================================
// MAIN SEED
// ============================================================================

export async function seedDatabase() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  console.log('🗑️  Limpando banco...');

  // Disable FK checks and truncate all relevant tables
  await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
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
  for (const table of tables) {
    try {
      await AppDataSource.query(`DELETE FROM \`${table}\``);
    } catch {
      /* table may not exist */
    }
  }
  await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 1');

  const doctorRepo = AppDataSource.getRepository(Doctor);
  const patientRepo = AppDataSource.getRepository(Patient);
  const clinicRepo = AppDataSource.getRepository(Clinic);
  const membershipRepo = AppDataSource.getRepository(ClinicMembership);
  const permissionRepo = AppDataSource.getRepository(DoctorPermission);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // ── 1. Clínica ──────────────────────────────────────────────────────────────
  console.log('🏥 Criando clínica...');
  const clinic = clinicRepo.create({ ...CLINIC_DATA, isActive: true });
  const savedClinic = await clinicRepo.save(clinic);

  // ── 2. Médico Admin (Hipócrates) ────────────────────────────────────────────
  console.log('👨‍⚕️ Criando admin (Hipócrates)...');
  const admin = doctorRepo.create({
    name: 'Dr. Hipócrates Medeiros',
    email: ADMIN_EMAIL,
    password: passwordHash,
    gender: 'Masculino',
    phone: '11999000001',
    birthDate: new Date('1980-06-15'),
    specialty: 'Clínica Geral',
    crm: '100001/SP',
    cpf: '10000000001',
    type: 'doctor',
    isShadow: false,
    emailVerified: true,
    verificationStatus: 'APPROVED',
  });
  const savedAdmin = await doctorRepo.save(admin);

  // Membership admin
  const adminMembership = membershipRepo.create({
    clinicId: savedClinic.id,
    professionalId: savedAdmin.id,
    role: ProfessionalRole.ADMIN,
    isActive: true,
  });
  await membershipRepo.save(adminMembership);

  // ── 3. 10 Médicos ──────────────────────────────────────────────────────────
  console.log('👩‍⚕️ Criando 10 médicos...');
  const savedDoctors: Doctor[] = [];

  for (const docData of DOCTORS_DATA) {
    const doc = doctorRepo.create({
      ...docData,
      password: passwordHash,
      birthDate: new Date(docData.birthDate),
      type: 'doctor',
      isShadow: false,
      emailVerified: true,
      verificationStatus: 'APPROVED',
    });
    const saved = await doctorRepo.save(doc);
    savedDoctors.push(saved);

    // Membership como doctor na clínica
    const membership = membershipRepo.create({
      clinicId: savedClinic.id,
      professionalId: saved.id,
      role: ProfessionalRole.DOCTOR,
      isActive: true,
    });
    await membershipRepo.save(membership);
  }

  // ── 4. 160 Pacientes ───────────────────────────────────────────────────────
  console.log('🧑‍🤝‍🧑 Criando 160 pacientes...');
  const savedPatients: Patient[] = [];

  for (let i = 0; i < PATIENT_NAMES.length; i++) {
    const name = PATIENT_NAMES[i];
    const gender = i % 2 === 0 ? 'Feminino' : 'Masculino';
    const day = (i % 28) + 1;
    const month = (i % 12) + 1;
    const year = 1970 + (i % 30);

    // Primeiros 120 pacientes criados por médicos (distribuídos)
    let creatorId: string | null = null;
    if (i < 20) {
      creatorId = savedAdmin.id; // Admin: pacientes 0-19
    } else if (i < 120) {
      const docIndex = Math.floor((i - 20) / 10); // Cada médico: 10 pacientes
      if (docIndex < savedDoctors.length) {
        creatorId = savedDoctors[docIndex].id;
      }
    }
    // Pacientes 120-159: sem vínculo (aparecem só na busca global)

    const patient = patientRepo.create({
      name,
      email: normalizeEmail(name),
      password: passwordHash,
      gender,
      phone: `1198765${String(i + 1).padStart(4, '0')}`,
      birthDate: new Date(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      ),
      type: 'patient',
      isShadow: false,
      emailVerified: true,
      doctorCreatorId: creatorId,
    });
    const saved = await patientRepo.save(patient);
    savedPatients.push(saved);
  }

  // ── 5. Permissões ──────────────────────────────────────────────────────────
  console.log('🔑 Criando permissões...');

  // Admin: acesso aos primeiros 20 pacientes
  for (let i = 0; i < 20; i++) {
    const perm = permissionRepo.create({
      doctorId: savedAdmin.id,
      patientId: savedPatients[i].id,
      isActive: true,
    });
    await permissionRepo.save(perm);
  }

  // Cada médico: acesso a 10 pacientes
  for (let docIdx = 0; docIdx < savedDoctors.length; docIdx++) {
    const startIdx = 20 + docIdx * 10;
    for (let i = startIdx; i < startIdx + 10 && i < savedPatients.length; i++) {
      const perm = permissionRepo.create({
        doctorId: savedDoctors[docIdx].id,
        patientId: savedPatients[i].id,
        isActive: true,
      });
      await permissionRepo.save(perm);
    }
  }

  // ── Resumo ─────────────────────────────────────────────────────────────────
  console.log('');
  console.log('✅ Seed finalizado!');
  console.log('═══════════════════════════════════════════════');
  console.log(`🏥 Clínica: ${savedClinic.name} (${savedClinic.id})`);
  console.log(`👨‍⚕️ Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`👩‍⚕️ Médicos: ${savedDoctors.length} (mesma senha)`);
  console.log(`🧑‍🤝‍🧑 Pacientes: ${savedPatients.length}`);
  console.log(`🔑 Permissões: ${20 + savedDoctors.length * 10}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
  console.log('Médicos da clínica:');
  for (const doc of savedDoctors) {
    console.log(`  • ${doc.name} (${doc.email}) — ${doc.specialty}`);
  }

  await AppDataSource.destroy();
}

// Executar se chamado diretamente
if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('❌ Erro ao executar seed:', error.message || error);
    process.exit(1);
  });
}
