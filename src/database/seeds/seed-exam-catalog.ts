import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ExamCategory } from '../../entities/exam-category.entity';
import { ExamCatalog } from '../../entities/exam-catalog.entity';

/**
 * Comprehensive exam catalog seed based on common Brazilian clinical laboratory tests.
 * Run: npx ts-node -r tsconfig-paths/register src/database/seeds/seed-exam-catalog.ts
 */

const CATEGORIES = [
  'Hematologia',
  'Bioquímica',
  'Hormônios',
  'Imunologia e Sorologia',
  'Urinálise',
  'Microbiologia',
  'Coagulação',
  'Marcadores Tumorais',
  'Cardiologia',
  'Imagem',
  'Endoscopia',
  'Genética',
  'Toxicologia',
  'Parasitologia',
];

const EXAMS: { name: string; category: string; duration: number; price: number; synonyms?: string }[] = [
  // Hematologia
  { name: 'Hemograma Completo', category: 'Hematologia', duration: 30, price: 25.00, synonyms: 'CBC, hemograma' },
  { name: 'Hemoglobina Glicada (HbA1c)', category: 'Hematologia', duration: 60, price: 35.00, synonyms: 'A1C, glicada' },
  { name: 'Velocidade de Hemossedimentação (VHS)', category: 'Hematologia', duration: 60, price: 15.00, synonyms: 'VHS, ESR' },
  { name: 'Reticulócitos', category: 'Hematologia', duration: 30, price: 20.00 },
  { name: 'Eletroforese de Hemoglobina', category: 'Hematologia', duration: 120, price: 45.00 },
  { name: 'Ferro Sérico', category: 'Hematologia', duration: 30, price: 20.00 },
  { name: 'Ferritina', category: 'Hematologia', duration: 60, price: 30.00 },
  { name: 'Transferrina', category: 'Hematologia', duration: 60, price: 30.00 },
  { name: 'Capacidade Total de Ligação do Ferro (TIBC)', category: 'Hematologia', duration: 60, price: 25.00 },

  // Bioquímica
  { name: 'Glicose em Jejum', category: 'Bioquímica', duration: 15, price: 10.00, synonyms: 'glicemia de jejum' },
  { name: 'Glicose Pós-Prandial', category: 'Bioquímica', duration: 120, price: 12.00 },
  { name: 'Teste de Tolerância à Glicose (TOTG)', category: 'Bioquímica', duration: 180, price: 40.00, synonyms: 'curva glicêmica' },
  { name: 'Colesterol Total', category: 'Bioquímica', duration: 30, price: 12.00 },
  { name: 'HDL Colesterol', category: 'Bioquímica', duration: 30, price: 12.00 },
  { name: 'LDL Colesterol', category: 'Bioquímica', duration: 30, price: 12.00 },
  { name: 'VLDL Colesterol', category: 'Bioquímica', duration: 30, price: 12.00 },
  { name: 'Triglicerídeos', category: 'Bioquímica', duration: 30, price: 12.00, synonyms: 'triglicérides' },
  { name: 'Perfil Lipídico Completo', category: 'Bioquímica', duration: 30, price: 45.00, synonyms: 'lipidograma' },
  { name: 'Ureia', category: 'Bioquímica', duration: 30, price: 10.00, synonyms: 'BUN' },
  { name: 'Creatinina', category: 'Bioquímica', duration: 30, price: 10.00 },
  { name: 'Ácido Úrico', category: 'Bioquímica', duration: 30, price: 12.00 },
  { name: 'TGO (AST)', category: 'Bioquímica', duration: 30, price: 12.00, synonyms: 'aspartato aminotransferase' },
  { name: 'TGP (ALT)', category: 'Bioquímica', duration: 30, price: 12.00, synonyms: 'alanina aminotransferase' },
  { name: 'Gama GT (GGT)', category: 'Bioquímica', duration: 30, price: 15.00, synonyms: 'gama glutamil transferase' },
  { name: 'Fosfatase Alcalina', category: 'Bioquímica', duration: 30, price: 12.00 },
  { name: 'Bilirrubina Total e Frações', category: 'Bioquímica', duration: 30, price: 15.00 },
  { name: 'Proteínas Totais e Frações', category: 'Bioquímica', duration: 30, price: 15.00, synonyms: 'albumina, globulina' },
  { name: 'Albumina', category: 'Bioquímica', duration: 30, price: 10.00 },
  { name: 'Sódio', category: 'Bioquímica', duration: 30, price: 10.00, synonyms: 'Na' },
  { name: 'Potássio', category: 'Bioquímica', duration: 30, price: 10.00, synonyms: 'K' },
  { name: 'Cálcio Total', category: 'Bioquímica', duration: 30, price: 12.00 },
  { name: 'Cálcio Iônico', category: 'Bioquímica', duration: 30, price: 15.00 },
  { name: 'Magnésio', category: 'Bioquímica', duration: 30, price: 12.00 },
  { name: 'Fósforo', category: 'Bioquímica', duration: 30, price: 12.00 },
  { name: 'Cloro', category: 'Bioquímica', duration: 30, price: 10.00 },
  { name: 'Amilase', category: 'Bioquímica', duration: 30, price: 15.00 },
  { name: 'Lipase', category: 'Bioquímica', duration: 30, price: 15.00 },
  { name: 'LDH (Desidrogenase Láctica)', category: 'Bioquímica', duration: 30, price: 15.00 },
  { name: 'CPK (Creatinoquinase)', category: 'Bioquímica', duration: 30, price: 15.00 },
  { name: 'CPK-MB', category: 'Bioquímica', duration: 30, price: 20.00 },
  { name: 'Vitamina D (25-OH)', category: 'Bioquímica', duration: 120, price: 60.00 },
  { name: 'Vitamina B12', category: 'Bioquímica', duration: 120, price: 40.00 },
  { name: 'Ácido Fólico', category: 'Bioquímica', duration: 120, price: 35.00 },
  { name: 'Proteína C Reativa (PCR)', category: 'Bioquímica', duration: 60, price: 20.00, synonyms: 'CRP' },
  { name: 'PCR Ultrassensível', category: 'Bioquímica', duration: 60, price: 30.00 },

  // Hormônios
  { name: 'TSH', category: 'Hormônios', duration: 60, price: 25.00, synonyms: 'tireotrofina' },
  { name: 'T4 Livre', category: 'Hormônios', duration: 60, price: 25.00, synonyms: 'tiroxina livre' },
  { name: 'T3 Total', category: 'Hormônios', duration: 60, price: 25.00 },
  { name: 'T3 Livre', category: 'Hormônios', duration: 60, price: 25.00 },
  { name: 'Anti-TPO', category: 'Hormônios', duration: 120, price: 40.00, synonyms: 'anticorpo anti-peroxidase' },
  { name: 'Anti-Tireoglobulina', category: 'Hormônios', duration: 120, price: 40.00 },
  { name: 'Testosterona Total', category: 'Hormônios', duration: 60, price: 35.00 },
  { name: 'Testosterona Livre', category: 'Hormônios', duration: 60, price: 40.00 },
  { name: 'Estradiol', category: 'Hormônios', duration: 60, price: 30.00 },
  { name: 'Progesterona', category: 'Hormônios', duration: 60, price: 30.00 },
  { name: 'FSH', category: 'Hormônios', duration: 60, price: 25.00, synonyms: 'folículo estimulante' },
  { name: 'LH', category: 'Hormônios', duration: 60, price: 25.00, synonyms: 'luteinizante' },
  { name: 'Prolactina', category: 'Hormônios', duration: 60, price: 30.00 },
  { name: 'Cortisol', category: 'Hormônios', duration: 60, price: 30.00 },
  { name: 'DHEA-S', category: 'Hormônios', duration: 60, price: 35.00 },
  { name: 'Insulina', category: 'Hormônios', duration: 60, price: 30.00 },
  { name: 'GH (Hormônio do Crescimento)', category: 'Hormônios', duration: 60, price: 40.00 },
  { name: 'IGF-1 (Somatomedina C)', category: 'Hormônios', duration: 120, price: 50.00 },
  { name: 'PTH (Paratormônio)', category: 'Hormônios', duration: 120, price: 50.00 },
  { name: 'Beta-HCG Quantitativo', category: 'Hormônios', duration: 60, price: 25.00, synonyms: 'teste de gravidez' },
  { name: 'PSA Total', category: 'Hormônios', duration: 60, price: 30.00, synonyms: 'antígeno prostático' },
  { name: 'PSA Livre', category: 'Hormônios', duration: 60, price: 35.00 },

  // Imunologia e Sorologia
  { name: 'HIV 1 e 2 (Anti-HIV)', category: 'Imunologia e Sorologia', duration: 60, price: 25.00 },
  { name: 'VDRL', category: 'Imunologia e Sorologia', duration: 30, price: 15.00, synonyms: 'sífilis' },
  { name: 'FTA-ABS', category: 'Imunologia e Sorologia', duration: 60, price: 30.00 },
  { name: 'Hepatite B (HBsAg)', category: 'Imunologia e Sorologia', duration: 60, price: 25.00 },
  { name: 'Hepatite B (Anti-HBs)', category: 'Imunologia e Sorologia', duration: 60, price: 25.00 },
  { name: 'Hepatite B (Anti-HBc Total)', category: 'Imunologia e Sorologia', duration: 60, price: 25.00 },
  { name: 'Hepatite C (Anti-HCV)', category: 'Imunologia e Sorologia', duration: 60, price: 30.00 },
  { name: 'Rubéola IgG e IgM', category: 'Imunologia e Sorologia', duration: 60, price: 35.00 },
  { name: 'Toxoplasmose IgG e IgM', category: 'Imunologia e Sorologia', duration: 60, price: 35.00 },
  { name: 'Citomegalovírus IgG e IgM', category: 'Imunologia e Sorologia', duration: 60, price: 35.00 },
  { name: 'FAN (Fator Antinuclear)', category: 'Imunologia e Sorologia', duration: 120, price: 40.00 },
  { name: 'Fator Reumatoide', category: 'Imunologia e Sorologia', duration: 60, price: 20.00 },
  { name: 'Anti-CCP', category: 'Imunologia e Sorologia', duration: 120, price: 60.00 },
  { name: 'Complemento C3', category: 'Imunologia e Sorologia', duration: 60, price: 25.00 },
  { name: 'Complemento C4', category: 'Imunologia e Sorologia', duration: 60, price: 25.00 },
  { name: 'IgA Total', category: 'Imunologia e Sorologia', duration: 60, price: 25.00 },
  { name: 'IgE Total', category: 'Imunologia e Sorologia', duration: 60, price: 30.00 },
  { name: 'IgG Total', category: 'Imunologia e Sorologia', duration: 60, price: 25.00 },
  { name: 'IgM Total', category: 'Imunologia e Sorologia', duration: 60, price: 25.00 },

  // Urinálise
  { name: 'EAS (Urina Tipo I)', category: 'Urinálise', duration: 30, price: 12.00, synonyms: 'urina rotina, sumário de urina' },
  { name: 'Urocultura com Antibiograma', category: 'Urinálise', duration: 4320, price: 35.00 },
  { name: 'Clearance de Creatinina', category: 'Urinálise', duration: 1440, price: 25.00 },
  { name: 'Microalbuminúria', category: 'Urinálise', duration: 60, price: 30.00 },
  { name: 'Proteinúria de 24h', category: 'Urinálise', duration: 1440, price: 25.00 },
  { name: 'Urina de 24 Horas', category: 'Urinálise', duration: 1440, price: 20.00 },

  // Microbiologia
  { name: 'Hemocultura', category: 'Microbiologia', duration: 4320, price: 50.00 },
  { name: 'Coprocultura', category: 'Microbiologia', duration: 4320, price: 40.00 },
  { name: 'Cultura de Secreção', category: 'Microbiologia', duration: 4320, price: 40.00 },
  { name: 'Antibiograma', category: 'Microbiologia', duration: 4320, price: 30.00 },
  { name: 'Pesquisa de BAAR', category: 'Microbiologia', duration: 60, price: 20.00, synonyms: 'baciloscopia' },

  // Coagulação
  { name: 'Tempo de Protrombina (TP/INR)', category: 'Coagulação', duration: 30, price: 15.00, synonyms: 'TAP, INR' },
  { name: 'Tempo de Tromboplastina Parcial (TTPa)', category: 'Coagulação', duration: 30, price: 15.00 },
  { name: 'Fibrinogênio', category: 'Coagulação', duration: 30, price: 20.00 },
  { name: 'D-Dímero', category: 'Coagulação', duration: 60, price: 50.00 },
  { name: 'Tempo de Sangramento', category: 'Coagulação', duration: 15, price: 10.00 },
  { name: 'Contagem de Plaquetas', category: 'Coagulação', duration: 30, price: 10.00 },

  // Marcadores Tumorais
  { name: 'CEA (Antígeno Carcinoembrionário)', category: 'Marcadores Tumorais', duration: 120, price: 40.00 },
  { name: 'CA 125', category: 'Marcadores Tumorais', duration: 120, price: 50.00 },
  { name: 'CA 19-9', category: 'Marcadores Tumorais', duration: 120, price: 50.00 },
  { name: 'CA 15-3', category: 'Marcadores Tumorais', duration: 120, price: 50.00 },
  { name: 'AFP (Alfa-Fetoproteína)', category: 'Marcadores Tumorais', duration: 120, price: 40.00 },

  // Cardiologia
  { name: 'Eletrocardiograma (ECG)', category: 'Cardiologia', duration: 15, price: 50.00 },
  { name: 'Ecocardiograma', category: 'Cardiologia', duration: 30, price: 200.00 },
  { name: 'Teste Ergométrico', category: 'Cardiologia', duration: 60, price: 150.00, synonyms: 'teste de esforço' },
  { name: 'Holter 24h', category: 'Cardiologia', duration: 1440, price: 180.00 },
  { name: 'MAPA 24h', category: 'Cardiologia', duration: 1440, price: 150.00 },
  { name: 'Troponina', category: 'Cardiologia', duration: 60, price: 40.00 },
  { name: 'BNP / NT-proBNP', category: 'Cardiologia', duration: 60, price: 60.00 },

  // Imagem
  { name: 'Raio-X de Tórax', category: 'Imagem', duration: 15, price: 60.00 },
  { name: 'Raio-X de Coluna', category: 'Imagem', duration: 15, price: 70.00 },
  { name: 'Ultrassonografia Abdominal', category: 'Imagem', duration: 30, price: 120.00 },
  { name: 'Ultrassonografia Pélvica', category: 'Imagem', duration: 30, price: 120.00 },
  { name: 'Ultrassonografia de Tireoide', category: 'Imagem', duration: 20, price: 100.00 },
  { name: 'Ultrassonografia de Mama', category: 'Imagem', duration: 30, price: 120.00 },
  { name: 'Ultrassonografia Transvaginal', category: 'Imagem', duration: 20, price: 130.00 },
  { name: 'Mamografia', category: 'Imagem', duration: 20, price: 150.00 },
  { name: 'Tomografia Computadorizada (TC)', category: 'Imagem', duration: 30, price: 350.00 },
  { name: 'Ressonância Magnética (RM)', category: 'Imagem', duration: 45, price: 600.00 },
  { name: 'Densitometria Óssea', category: 'Imagem', duration: 20, price: 120.00 },
  { name: 'Cintilografia', category: 'Imagem', duration: 60, price: 300.00 },

  // Endoscopia
  { name: 'Endoscopia Digestiva Alta', category: 'Endoscopia', duration: 30, price: 300.00 },
  { name: 'Colonoscopia', category: 'Endoscopia', duration: 60, price: 450.00 },
  { name: 'Retossigmoidoscopia', category: 'Endoscopia', duration: 30, price: 250.00 },

  // Genética
  { name: 'Cariótipo', category: 'Genética', duration: 20160, price: 250.00 },
  { name: 'PCR para COVID-19', category: 'Genética', duration: 360, price: 150.00, synonyms: 'RT-PCR, SARS-CoV-2' },
  { name: 'Teste de Paternidade (DNA)', category: 'Genética', duration: 43200, price: 800.00 },

  // Toxicologia
  { name: 'Dosagem de Lítio', category: 'Toxicologia', duration: 60, price: 25.00 },
  { name: 'Dosagem de Valproato', category: 'Toxicologia', duration: 60, price: 30.00 },
  { name: 'Teste Toxicológico', category: 'Toxicologia', duration: 120, price: 80.00 },

  // Parasitologia
  { name: 'Parasitológico de Fezes (EPF)', category: 'Parasitologia', duration: 60, price: 15.00, synonyms: 'protoparasitológico' },
  { name: 'Pesquisa de Sangue Oculto nas Fezes', category: 'Parasitologia', duration: 60, price: 20.00 },
  { name: 'Coprocultura', category: 'Parasitologia', duration: 4320, price: 35.00 },
];

export async function seedExamCatalog() {
  // Use dynamic import to get the shared data source
  const { default: AppDataSource } = await import('../data-source');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const categoryRepo = AppDataSource.getRepository(ExamCategory);
  const examRepo = AppDataSource.getRepository(ExamCatalog);

  // Check if already seeded
  const existingCount = await examRepo.count();
  if (existingCount > 0) {
    console.log(`Exam catalog already has ${existingCount} items. Skipping seed.`);
    return;
  }

  // Create categories
  const categoryMap: Record<string, string> = {};
  for (const name of CATEGORIES) {
    const existing = await categoryRepo.findOne({ where: { name } });
    if (existing) {
      categoryMap[name] = existing.id;
    } else {
      const cat = categoryRepo.create({ name });
      const saved = await categoryRepo.save(cat);
      categoryMap[name] = saved.id;
    }
  }
  console.log(`Created ${CATEGORIES.length} exam categories.`);

  // Create exams
  let created = 0;
  for (const exam of EXAMS) {
    const categoryId = categoryMap[exam.category];
    if (!categoryId) {
      console.warn(`Category not found for exam: ${exam.name}`);
      continue;
    }

    const entry = examRepo.create({
      name: exam.name,
      categoryId,
      synonyms: exam.synonyms || null,
      estimatedDuration: exam.duration,
      price: exam.price,
      isActive: true,
      preparationInstructions: null,
    });
    await examRepo.save(entry);
    created++;
  }

  console.log(`Created ${created} exam catalog entries.`);
}

async function main() {
  const { DataSource } = await import('typeorm');

  const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USERNAME || 'pocketmed_user',
    password: process.env.DB_PASSWORD || 'pocketmed_pass',
    database: process.env.DB_DATABASE || 'pocketmed',
    entities: [ExamCategory, ExamCatalog],
    synchronize: false,
  });

  await AppDataSource.initialize();
  console.log('Connected to database.');

  const categoryRepo = AppDataSource.getRepository(ExamCategory);
  const examRepo = AppDataSource.getRepository(ExamCatalog);

  const existingCount = await examRepo.count();
  if (existingCount > 0) {
    console.log(`Exam catalog already has ${existingCount} items. Skipping seed.`);
    await AppDataSource.destroy();
    return;
  }

  const categoryMap: Record<string, string> = {};
  for (const name of CATEGORIES) {
    const existing = await categoryRepo.findOne({ where: { name } });
    if (existing) {
      categoryMap[name] = existing.id;
    } else {
      const cat = categoryRepo.create({ name });
      const saved = await categoryRepo.save(cat);
      categoryMap[name] = saved.id;
    }
  }
  console.log(`Created ${CATEGORIES.length} categories.`);

  let created = 0;
  for (const exam of EXAMS) {
    const categoryId = categoryMap[exam.category];
    if (!categoryId) continue;
    const entry = examRepo.create({
      name: exam.name,
      categoryId,
      synonyms: exam.synonyms || null,
      estimatedDuration: exam.duration,
      price: exam.price,
      isActive: true,
      preparationInstructions: null,
    });
    await examRepo.save(entry);
    created++;
  }

  console.log(`Created ${created} exam catalog entries.`);
  await AppDataSource.destroy();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
