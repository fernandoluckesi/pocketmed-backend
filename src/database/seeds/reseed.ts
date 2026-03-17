import 'reflect-metadata';
import AppDataSource from '../data-source';
import { seedDatabase } from './run-seed';

const TABLES_TO_TRUNCATE = [
  'dependent_responsibles',
  'doctor_access_requests',
  'doctor_permissions',
  'medications',
  'exams',
  'appointments',
  'dependents',
  'patients',
  'doctors',
];

async function reseedDatabase() {
  await AppDataSource.initialize();

  try {
    await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of TABLES_TO_TRUNCATE) {
      await AppDataSource.query(`TRUNCATE TABLE \`${table}\``);
    }

    await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  } catch (error) {
    await AppDataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }

  await seedDatabase();
}

reseedDatabase().catch(async (error) => {
  console.error('Erro ao executar reseed:', error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
