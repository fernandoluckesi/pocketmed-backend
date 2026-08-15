import 'reflect-metadata';
import 'dotenv/config';
import AppDataSource from '../data-source';

async function run() {
  await AppDataSource.initialize();

  const [juliana] = await AppDataSource.query(
    "SELECT id FROM patients WHERE email = 'juliana.silva@email.com' LIMIT 1",
  );
  if (!juliana) {
    console.log('Juliana not found');
    await AppDataSource.destroy();
    return;
  }
  const patientId = juliana.id;
  console.log('Juliana id:', patientId);

  // Create 3 dependents
  await AppDataSource.query(
    "INSERT INTO dependents (id, name, gender, type, birthDate, adminResponsibleId, createdAt, updatedAt) VALUES (UUID(), 'Lucas Silva', 'male', 'Filho', '2018-05-12', ?, NOW(), NOW())",
    [patientId],
  );
  await AppDataSource.query(
    "INSERT INTO dependents (id, name, gender, type, birthDate, adminResponsibleId, createdAt, updatedAt) VALUES (UUID(), 'Maria Clara Silva', 'female', 'Filha', '2020-11-03', ?, NOW(), NOW())",
    [patientId],
  );
  await AppDataSource.query(
    "INSERT INTO dependents (id, name, gender, type, birthDate, adminResponsibleId, createdAt, updatedAt) VALUES (UUID(), 'Helena Silva', 'female', 'Filha', '2015-02-28', ?, NOW(), NOW())",
    [patientId],
  );

  // Get the created dependents
  const deps = await AppDataSource.query(
    "SELECT id, name FROM dependents WHERE adminResponsibleId = ? ORDER BY createdAt DESC LIMIT 3",
    [patientId],
  );
  console.log('Dependents:', deps);

  // Link responsibles (many-to-many)
  for (const dep of deps) {
    await AppDataSource.query(
      "INSERT INTO dependent_responsibles (dependentId, patientId) VALUES (?, ?)",
      [dep.id, patientId],
    );
  }

  console.log('Done! 3 dependents created for Juliana');
  await AppDataSource.destroy();
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
