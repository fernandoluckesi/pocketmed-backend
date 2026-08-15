import 'reflect-metadata';
import 'dotenv/config';
import AppDataSource from '../data-source';

async function run() {
  await AppDataSource.initialize();

  const clinicId = '3aeb2f8f-a698-4cb1-8ddd-2399518c9e75';
  const doctorId = 'f0d4ada7-8774-4d34-b6c8-93b6f030d410';

  // Create cost centers
  await AppDataSource.query(
    "INSERT IGNORE INTO financial_cost_centers (id, clinicId, name, description, active, createdAt, updatedAt) VALUES (UUID(), ?, 'Consultório', 'Centro principal', 1, NOW(), NOW())",
    [clinicId],
  );
  await AppDataSource.query(
    "INSERT IGNORE INTO financial_cost_centers (id, clinicId, name, description, active, createdAt, updatedAt) VALUES (UUID(), ?, 'Administrativo', 'Despesas administrativas', 1, NOW(), NOW())",
    [clinicId],
  );
  console.log('Cost centers: 2');

  // Get costCenter id
  const [cc] = await AppDataSource.query("SELECT id FROM financial_cost_centers WHERE clinicId = ? LIMIT 1", [clinicId]);
  const costCenterId = cc.id;

  // Create revenues (contas a receber)
  const revenues = [
    { procedure: 'Consulta Particular', specialty: 'Clinica Geral', gross: 350, net: 350, method: 'PIX', status: 'PAGO', due: '2025-08-01' },
    { procedure: 'Consulta Particular', specialty: 'Clinica Geral', gross: 350, net: 350, method: 'Cartao Credito', status: 'PAGO', due: '2025-08-03' },
    { procedure: 'Ecocardiograma', specialty: 'Cardiologia', gross: 800, net: 800, method: 'PIX', status: 'PAGO', due: '2025-08-05' },
    { procedure: 'Consulta Retorno', specialty: 'Clinica Geral', gross: 250, net: 250, method: 'Dinheiro', status: 'PAGO', due: '2025-08-07' },
    { procedure: 'Check-up Completo', specialty: 'Clinica Geral', gross: 1200, net: 1200, method: 'Cartao Credito', status: 'PENDENTE', due: '2025-08-15' },
    { procedure: 'Consulta Particular', specialty: 'Clinica Geral', gross: 350, net: 350, method: 'PIX', status: 'PENDENTE', due: '2025-08-20' },
    { procedure: 'Eletrocardiograma', specialty: 'Cardiologia', gross: 450, net: 450, method: 'Convênio', status: 'PENDENTE', due: '2025-08-25' },
    { procedure: 'Consulta Particular', specialty: 'Clinica Geral', gross: 350, net: 350, method: 'PIX', status: 'PAGO', due: '2025-07-20' },
    { procedure: 'Teste Ergométrico', specialty: 'Cardiologia', gross: 600, net: 600, method: 'Cartao Debito', status: 'PAGO', due: '2025-07-25' },
    { procedure: 'Consulta Particular', specialty: 'Clinica Geral', gross: 350, net: 315, method: 'PIX', status: 'PAGO', due: '2025-07-28' },
  ];

  for (const r of revenues) {
    await AppDataSource.query(
      `INSERT INTO financial_revenues (id, clinicId, doctorId, \`procedure\`, specialty, grossValue, discountValue, netValue, paymentMethod, status, dueDate, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW(), NOW())`,
      [clinicId, doctorId, r.procedure, r.specialty, r.gross, r.net, r.method, r.status, r.due],
    );
  }
  console.log('Revenues:', revenues.length);

  // Create expenses (contas a pagar)
  const expenses = [
    { category: 'Estrutura', provider: 'Imobiliária Central', desc: 'Aluguel Agosto', gross: 5000, net: 5000, method: 'Transferência', status: 'PAGO', due: '2025-08-05' },
    { category: 'Estrutura', provider: 'CPFL Energia', desc: 'Conta de luz', gross: 850, net: 850, method: 'Boleto', status: 'PAGO', due: '2025-08-10' },
    { category: 'Tecnologia', provider: 'PocketMed SaaS', desc: 'Assinatura mensal', gross: 299, net: 299, method: 'Cartao Credito', status: 'PAGO', due: '2025-08-01' },
    { category: 'Materiais', provider: 'Dental Med Suprimentos', desc: 'Material descartável', gross: 1200, net: 1200, method: 'Boleto', status: 'PENDENTE', due: '2025-08-20' },
    { category: 'Pessoal', provider: 'Secretária Maria', desc: 'Salário Agosto', gross: 3500, net: 3500, method: 'Transferência', status: 'PENDENTE', due: '2025-08-30' },
  ];

  for (const e of expenses) {
    await AppDataSource.query(
      `INSERT INTO financial_expenses (id, clinicId, costCenterId, category, provider, description, grossValue, netValue, paymentMethod, status, dueDate, createdAt, updatedAt) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [clinicId, costCenterId, e.category, e.provider, e.desc, e.gross, e.net, e.method, e.status, e.due],
    );
  }
  console.log('Expenses:', expenses.length);

  await AppDataSource.destroy();
  console.log('Financial seed done!');
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
