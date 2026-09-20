import 'reflect-metadata';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { MedicationCatalog } from '../../entities/medication-catalog.entity';

/**
 * Imports the official ANVISA/CMED medication price list into medication_catalog.
 * Source: https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos
 * (Lista de Preços de Medicamentos, PMC) — one row per commercial presentation.
 *
 * Run: npm run seed:medications
 */

interface RawEntry {
  s: string; // substance
  p: string; // product
  a: string; // presentation
  l: string; // manufacturer
  r: string; // registrationNumber
  c: string; // therapeuticClass
  t: string; // productType
}

const DATA_FILE = path.join(__dirname, 'data', 'medication-catalog.json');
const CHUNK_SIZE = 1000;

async function main() {
  const { default: AppDataSource } = await import('../data-source');

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const repo = AppDataSource.getRepository(MedicationCatalog);

  const existingCount = await repo.count();
  if (existingCount > 0) {
    console.log(`Medication catalog already has ${existingCount} items. Skipping seed.`);
    await AppDataSource.destroy();
    return;
  }

  console.log('Reading ANVISA medication data file...');
  const raw: RawEntry[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  console.log(`Loaded ${raw.length} entries. Importing in batches of ${CHUNK_SIZE}...`);

  let imported = 0;
  for (let i = 0; i < raw.length; i += CHUNK_SIZE) {
    const chunk = raw.slice(i, i + CHUNK_SIZE).map((entry) => ({
      substance: entry.s || '',
      product: entry.p || '',
      presentation: entry.a || null,
      manufacturer: entry.l || null,
      registrationNumber: entry.r || null,
      therapeuticClass: entry.c || null,
      productType: entry.t || null,
    }));

    await repo.createQueryBuilder().insert().into(MedicationCatalog).values(chunk).execute();
    imported += chunk.length;
    process.stdout.write(`\r  ${imported}/${raw.length} imported...`);
  }

  console.log(`\nDone. ${imported} medication catalog entries imported.`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
