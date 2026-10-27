import 'reflect-metadata';
import AppDataSource from '../data-source';
import { Patient } from '../../entities/patient.entity';

/**
 * Backfills `username` for every existing patient that doesn't have one yet
 * (demo/seed data predates the field). Real self-registered patients pick
 * their own username at signup — this is purely so local "Pesquisar
 * Pacientes" search results have usernames to show, matching what the
 * mobile signup form now requires going forward.
 *
 * Generated usernames use only the allowed character set (letters, digits,
 * dots) and are de-duplicated against both the DB and this run.
 */

function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  // Leave room for a numeric de-dup suffix within the VARCHAR(30) column.
  return (base || 'paciente').slice(0, 24);
}

function uniqueUsername(name: string, taken: Set<string>): string {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 30);
  }
  taken.add(candidate);
  return candidate;
}

async function seedUsernames() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const patientRepo = AppDataSource.getRepository(Patient);

  const existingUsernames = await patientRepo
    .createQueryBuilder('patient')
    .select('patient.username', 'username')
    .where('patient.username IS NOT NULL')
    .getRawMany<{ username: string }>();
  const taken = new Set(existingUsernames.map((row) => row.username));

  const patientsWithoutUsername = await patientRepo.find({
    where: { username: null },
    select: ['id', 'name'],
    order: { createdAt: 'ASC' },
  });

  console.log(`Found ${patientsWithoutUsername.length} patients without a username.`);

  let updated = 0;
  for (const patient of patientsWithoutUsername) {
    const username = uniqueUsername(patient.name, taken);
    await patientRepo.update(patient.id, { username });
    updated++;
  }

  console.log(`\n✅ Seed complete: ${updated} patients updated with a generated username.`);

  await AppDataSource.destroy();
}

seedUsernames().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
