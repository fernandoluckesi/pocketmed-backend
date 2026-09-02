import 'reflect-metadata';
import 'dotenv/config';
import AppDataSource from '../data-source';
import { Clinic } from '../../entities/clinic.entity';
import { ClinicMembership } from '../../entities/clinic-membership.entity';
import { FinancialSettings } from '../../entities/financial-settings.entity';
import { FinancialCostCenter } from '../../entities/financial-cost-center.entity';
import { FinancialConvenio } from '../../entities/financial-convenio.entity';
import { FinancialRevenue } from '../../entities/financial-revenue.entity';
import { FinancialExpense } from '../../entities/financial-expense.entity';
import { FinancialDoctorTransfer } from '../../entities/financial-doctor-transfer.entity';
import { FinancialCashflowEntry } from '../../entities/financial-cashflow-entry.entity';

export async function seedFinancial() {
  const shouldDestroyConnection = !AppDataSource.isInitialized;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const clinicRepo = AppDataSource.getRepository(Clinic);
  const membershipRepo = AppDataSource.getRepository(ClinicMembership);
  const settingsRepo = AppDataSource.getRepository(FinancialSettings);
  const costCenterRepo = AppDataSource.getRepository(FinancialCostCenter);
  const convenioRepo = AppDataSource.getRepository(FinancialConvenio);
  const revenueRepo = AppDataSource.getRepository(FinancialRevenue);
  const expenseRepo = AppDataSource.getRepository(FinancialExpense);
  const transferRepo = AppDataSource.getRepository(FinancialDoctorTransfer);
  const cashflowRepo = AppDataSource.getRepository(FinancialCashflowEntry);

  // Find the seed clinic
  const clinic = await clinicRepo.findOne({ where: { name: 'Clínica Hispora Seed' } });
  if (!clinic) {
    console.log('⚠️  Clínica seed não encontrada. Execute seed:clinic primeiro.');
    return;
  }

  const clinicId = clinic.id;

  // Get doctor members
  const memberships = await membershipRepo.find({ where: { clinicId, isActive: true } });
  const doctorIds = memberships.map((m) => m.professionalId);

  console.log(`── Seed Financeiro para: ${clinic.name} (${doctorIds.length} membros) ──`);

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  let settings = await settingsRepo.findOne({ where: { clinicId } });
  if (!settings) {
    settings = settingsRepo.create({
      clinicId,
      taxRegime: 'SIMPLES_NACIONAL',
      issRate: 5.0,
      dasRate: 6.0,
      irpjRate: 0,
      csllRate: 0,
      defaultDoctorTransferPercentage: 55.0,
      bankName: 'Banco Itaú',
      bankAgency: '0456',
      bankAccount: '12345-6',
      pixKey: '12.345.678/0001-99',
      invoicePrefix: 'PM',
    });
    await settingsRepo.save(settings);
    console.log('✓ Settings financeiras criadas');
  }

  // ── COST CENTERS ──────────────────────────────────────────────────────────
  const costCentersData = [
    {
      name: 'Folha de Pagamento',
      code: 'CC001',
      budgetAllocated: 95000,
      color: '#2563EB',
      description: 'Salários, benefícios e encargos',
    },
    {
      name: 'Infraestrutura Predial',
      code: 'CC002',
      budgetAllocated: 18000,
      color: '#10B981',
      description: 'Aluguel, condomínio e manutenção',
    },
    {
      name: 'Insumos Médicos',
      code: 'CC003',
      budgetAllocated: 12000,
      color: '#8B5CF6',
      description: 'Material descartável e medicamentos',
    },
    {
      name: 'Marketing e Comunicação',
      code: 'CC004',
      budgetAllocated: 8000,
      color: '#EC4899',
      description: 'Publicidade, site e redes sociais',
    },
    {
      name: 'Tecnologia e SaaS',
      code: 'CC005',
      budgetAllocated: 5500,
      color: '#F59E0B',
      description: 'Sistemas, licenças e infraestrutura de TI',
    },
    {
      name: 'Seguros e Compliance',
      code: 'CC006',
      budgetAllocated: 14000,
      color: '#6B7280',
      description: 'Seguro do imóvel, RC profissional',
    },
  ];

  const costCenters: FinancialCostCenter[] = [];
  for (const cc of costCentersData) {
    let existing = await costCenterRepo.findOne({ where: { clinicId, code: cc.code } });
    if (!existing) {
      existing = costCenterRepo.create({ ...cc, clinicId, active: true });
      existing = await costCenterRepo.save(existing);
    }
    costCenters.push(existing);
  }
  console.log(`✓ ${costCenters.length} centros de custo`);

  // ── CONVENIOS ─────────────────────────────────────────────────────────────
  const conveniosData = [
    {
      name: 'Unimed Nacional',
      ansCode: '302147',
      cnpj: '02.812.468/0001-37',
      contractTable: 'tuss',
      paymentTerm: 30,
      glosaTolerance: 1.8,
      markupPercentage: 0,
      contactName: 'Carlos Mendes',
      contactPhone: '1132345678',
      contactEmail: 'contratos@unimed.com.br',
      notes: 'Renovação anual em março',
    },
    {
      name: 'Bradesco Saúde',
      ansCode: '005711',
      cnpj: '92.693.118/0001-60',
      contractTable: 'cbhpm',
      paymentTerm: 45,
      glosaTolerance: 2.1,
      markupPercentage: 5,
      contactName: 'Fernanda Alves',
      contactPhone: '1140028922',
      contactEmail: 'saude@bradesco.com.br',
      notes: 'Tabela CBHPM atualizada 2025',
    },
    {
      name: 'Amil',
      ansCode: '326305',
      cnpj: '29.309.127/0001-79',
      contractTable: 'tuss',
      paymentTerm: 60,
      glosaTolerance: 4.2,
      markupPercentage: 0,
      contactName: 'Roberto Lima',
      contactPhone: '1121003000',
      contactEmail: 'prestador@amil.com.br',
      notes: 'Prazo estendido para guias cirúrgicas',
    },
    {
      name: 'SulAmérica',
      ansCode: '006246',
      cnpj: '01.685.053/0001-56',
      contractTable: 'propria',
      paymentTerm: 30,
      glosaTolerance: 1.5,
      markupPercentage: 8,
      contactName: 'Patrícia Gomes',
      contactPhone: '1134447777',
      contactEmail: 'rede@sulamerica.com.br',
      notes: 'Tabela proprietária acima da TUSS',
    },
    {
      name: 'Hapvida',
      ansCode: '368253',
      cnpj: '63.554.067/0001-98',
      contractTable: 'tuss',
      paymentTerm: 45,
      glosaTolerance: 3.0,
      markupPercentage: 0,
      contactName: 'Marcos Vieira',
      contactPhone: '1132001000',
      contactEmail: 'redes@hapvida.com.br',
      notes: 'Contrato regional SP',
    },
  ];

  const convenios: FinancialConvenio[] = [];
  for (const conv of conveniosData) {
    let existing = await convenioRepo.findOne({ where: { clinicId, ansCode: conv.ansCode } });
    if (!existing) {
      existing = convenioRepo.create({ ...conv, clinicId, active: true });
      existing = await convenioRepo.save(existing);
    }
    convenios.push(existing);
  }
  console.log(`✓ ${convenios.length} convênios`);

  // ── REVENUES (realistic monthly data: Jul + Aug 2026) ─────────────────────
  const existingRevenues = await revenueRepo.count({ where: { clinicId } });
  if (existingRevenues === 0) {
    const revenueData = [
      // Julho 2026
      {
        procedure: 'Consulta Clínica Geral',
        specialty: 'Clínica Geral',
        grossValue: 350,
        netValue: 350,
        paymentMethod: 'PIX',
        status: 'PAGO',
        dueDate: '2026-07-02',
        paidAt: '2026-07-02',
      },
      {
        procedure: 'Consulta Clínica Geral',
        specialty: 'Clínica Geral',
        grossValue: 350,
        netValue: 350,
        paymentMethod: 'Cartão Crédito',
        status: 'PAGO',
        dueDate: '2026-07-04',
        paidAt: '2026-07-04',
      },
      {
        procedure: 'Ecocardiograma',
        specialty: 'Cardiologia',
        grossValue: 850,
        netValue: 850,
        paymentMethod: 'Convênio',
        status: 'PAGO',
        dueDate: '2026-07-06',
        paidAt: '2026-07-08',
        convenioId: convenios[0].id,
      },
      {
        procedure: 'Check-up Executivo',
        specialty: 'Clínica Geral',
        grossValue: 1800,
        netValue: 1800,
        paymentMethod: 'Cartão Crédito',
        status: 'PAGO',
        dueDate: '2026-07-08',
        paidAt: '2026-07-08',
      },
      {
        procedure: 'Eletrocardiograma',
        specialty: 'Cardiologia',
        grossValue: 450,
        netValue: 450,
        paymentMethod: 'Convênio',
        status: 'PAGO',
        dueDate: '2026-07-10',
        paidAt: '2026-07-12',
        convenioId: convenios[1].id,
      },
      {
        procedure: 'Consulta Retorno',
        specialty: 'Clínica Geral',
        grossValue: 250,
        netValue: 250,
        paymentMethod: 'PIX',
        status: 'PAGO',
        dueDate: '2026-07-12',
        paidAt: '2026-07-12',
      },
      {
        procedure: 'Teste Ergométrico',
        specialty: 'Cardiologia',
        grossValue: 650,
        netValue: 650,
        paymentMethod: 'Convênio',
        status: 'PAGO',
        dueDate: '2026-07-14',
        paidAt: '2026-07-16',
        convenioId: convenios[0].id,
      },
      {
        procedure: 'Consulta Clínica Geral',
        specialty: 'Clínica Geral',
        grossValue: 350,
        netValue: 350,
        paymentMethod: 'Dinheiro',
        status: 'PAGO',
        dueDate: '2026-07-16',
        paidAt: '2026-07-16',
      },
      {
        procedure: 'MAPA 24h',
        specialty: 'Cardiologia',
        grossValue: 380,
        netValue: 380,
        paymentMethod: 'Convênio',
        status: 'PAGO',
        dueDate: '2026-07-18',
        paidAt: '2026-07-20',
        convenioId: convenios[3].id,
      },
      {
        procedure: 'Consulta Clínica Geral',
        specialty: 'Clínica Geral',
        grossValue: 350,
        netValue: 350,
        paymentMethod: 'PIX',
        status: 'PAGO',
        dueDate: '2026-07-21',
        paidAt: '2026-07-21',
      },
      {
        procedure: 'Holter 24h',
        specialty: 'Cardiologia',
        grossValue: 420,
        netValue: 420,
        paymentMethod: 'Convênio',
        status: 'GLOSADO',
        dueDate: '2026-07-22',
        glosaValue: 420,
        glosaReason: 'Guia vencida',
        convenioId: convenios[2].id,
      },
      {
        procedure: 'Consulta Particular',
        specialty: 'Clínica Geral',
        grossValue: 350,
        netValue: 350,
        paymentMethod: 'PIX',
        status: 'PAGO',
        dueDate: '2026-07-25',
        paidAt: '2026-07-25',
      },
      // Agosto 2026
      {
        procedure: 'Consulta Clínica Geral',
        specialty: 'Clínica Geral',
        grossValue: 350,
        netValue: 350,
        paymentMethod: 'PIX',
        status: 'PAGO',
        dueDate: '2026-08-01',
        paidAt: '2026-08-01',
      },
      {
        procedure: 'Ecocardiograma',
        specialty: 'Cardiologia',
        grossValue: 850,
        netValue: 850,
        paymentMethod: 'Convênio',
        status: 'PAGO',
        dueDate: '2026-08-03',
        paidAt: '2026-08-05',
        convenioId: convenios[0].id,
      },
      {
        procedure: 'Consulta Clínica Geral',
        specialty: 'Clínica Geral',
        grossValue: 350,
        netValue: 350,
        paymentMethod: 'Cartão Débito',
        status: 'PAGO',
        dueDate: '2026-08-05',
        paidAt: '2026-08-05',
      },
      {
        procedure: 'Check-up Completo',
        specialty: 'Clínica Geral',
        grossValue: 1500,
        netValue: 1500,
        paymentMethod: 'Cartão Crédito',
        status: 'PAGO',
        dueDate: '2026-08-07',
        paidAt: '2026-08-07',
      },
      {
        procedure: 'Consulta Retorno',
        specialty: 'Clínica Geral',
        grossValue: 250,
        netValue: 250,
        paymentMethod: 'PIX',
        status: 'PAGO',
        dueDate: '2026-08-08',
        paidAt: '2026-08-08',
      },
      {
        procedure: 'Eletrocardiograma',
        specialty: 'Cardiologia',
        grossValue: 450,
        netValue: 450,
        paymentMethod: 'Convênio',
        status: 'PENDENTE',
        dueDate: '2026-08-12',
        convenioId: convenios[1].id,
      },
      {
        procedure: 'Consulta Particular',
        specialty: 'Clínica Geral',
        grossValue: 350,
        netValue: 350,
        paymentMethod: 'PIX',
        status: 'PENDENTE',
        dueDate: '2026-08-15',
      },
      {
        procedure: 'Teste Ergométrico',
        specialty: 'Cardiologia',
        grossValue: 650,
        netValue: 650,
        paymentMethod: 'Convênio',
        status: 'PENDENTE',
        dueDate: '2026-08-18',
        convenioId: convenios[0].id,
      },
      {
        procedure: 'MAPA 24h',
        specialty: 'Cardiologia',
        grossValue: 380,
        netValue: 380,
        paymentMethod: 'Convênio',
        status: 'PENDENTE',
        dueDate: '2026-08-20',
        convenioId: convenios[3].id,
      },
      {
        procedure: 'Consulta Clínica Geral',
        specialty: 'Clínica Geral',
        grossValue: 350,
        netValue: 350,
        paymentMethod: 'Cartão Crédito',
        status: 'PENDENTE',
        dueDate: '2026-08-22',
      },
      {
        procedure: 'Ecocardiograma Stress',
        specialty: 'Cardiologia',
        grossValue: 1200,
        netValue: 1200,
        paymentMethod: 'Convênio',
        status: 'FATURADO',
        dueDate: '2026-08-25',
        convenioId: convenios[1].id,
      },
    ];

    for (const r of revenueData) {
      const revenue = revenueRepo.create({
        clinicId,
        doctorId: doctorIds[0] || null,
        procedure: r.procedure,
        specialty: r.specialty,
        grossValue: r.grossValue,
        discountValue: 0,
        netValue: r.netValue,
        paymentMethod: r.paymentMethod,
        status: r.status,
        dueDate: new Date(r.dueDate),
        paidAt: (r as any).paidAt ? new Date((r as any).paidAt) : null,
        convenioId: (r as any).convenioId || null,
        glosaValue: (r as any).glosaValue || null,
        glosaReason: (r as any).glosaReason || null,
      });
      await revenueRepo.save(revenue);
    }
    console.log(`✓ ${revenueData.length} receitas (jul-ago/2026)`);
  }

  // ── EXPENSES ──────────────────────────────────────────────────────────────
  const existingExpenses = await expenseRepo.count({ where: { clinicId } });
  if (existingExpenses === 0) {
    const expenseData = [
      {
        category: 'Folha de Pagamento',
        provider: 'Departamento Pessoal',
        description: 'Salários e encargos - Agosto',
        grossValue: 42000,
        status: 'PENDENTE',
        dueDate: '2026-08-30',
        recurrence: 'MENSAL',
        costCenterIdx: 0,
      },
      {
        category: 'Folha de Pagamento',
        provider: 'Departamento Pessoal',
        description: 'Salários e encargos - Julho',
        grossValue: 42000,
        status: 'PAGO',
        dueDate: '2026-07-30',
        paidAt: '2026-07-30',
        recurrence: 'MENSAL',
        costCenterIdx: 0,
      },
      {
        category: 'Aluguel',
        provider: 'Imobiliária Central SP',
        description: 'Aluguel sala comercial - Agosto',
        grossValue: 8500,
        status: 'PAGO',
        dueDate: '2026-08-05',
        paidAt: '2026-08-05',
        recurrence: 'MENSAL',
        costCenterIdx: 1,
      },
      {
        category: 'Aluguel',
        provider: 'Imobiliária Central SP',
        description: 'Condomínio - Agosto',
        grossValue: 2200,
        status: 'PAGO',
        dueDate: '2026-08-10',
        paidAt: '2026-08-10',
        recurrence: 'MENSAL',
        costCenterIdx: 1,
      },
      {
        category: 'Energia',
        provider: 'Enel Distribuição SP',
        description: 'Conta de energia elétrica',
        grossValue: 1850,
        status: 'PENDENTE',
        dueDate: '2026-08-20',
        recurrence: 'MENSAL',
        costCenterIdx: 1,
      },
      {
        category: 'Insumos',
        provider: 'MedSupply Brasil',
        description: 'Luvas, seringas, algodão, álcool',
        grossValue: 3200,
        status: 'PAGO',
        dueDate: '2026-08-08',
        paidAt: '2026-08-08',
        recurrence: 'MENSAL',
        costCenterIdx: 2,
      },
      {
        category: 'Insumos',
        provider: 'Cirúrgica Fernandes',
        description: 'Equipamentos descartáveis',
        grossValue: 1800,
        status: 'PENDENTE',
        dueDate: '2026-08-22',
        recurrence: 'MENSAL',
        costCenterIdx: 2,
      },
      {
        category: 'Marketing',
        provider: 'Ativa Digital Clinic',
        description: 'Google Ads + Meta Ads',
        grossValue: 4500,
        status: 'PAGO',
        dueDate: '2026-08-01',
        paidAt: '2026-08-01',
        recurrence: 'MENSAL',
        costCenterIdx: 3,
      },
      {
        category: 'Tecnologia',
        provider: 'Hispora SaaS',
        description: 'Assinatura plataforma',
        grossValue: 599,
        status: 'PAGO',
        dueDate: '2026-08-01',
        paidAt: '2026-08-01',
        recurrence: 'MENSAL',
        costCenterIdx: 4,
      },
      {
        category: 'Tecnologia',
        provider: 'AWS Cloud Services',
        description: 'Hospedagem e banco de dados',
        grossValue: 320,
        status: 'PAGO',
        dueDate: '2026-08-05',
        paidAt: '2026-08-05',
        recurrence: 'MENSAL',
        costCenterIdx: 4,
      },
      {
        category: 'Seguros',
        provider: 'Porto Seguro Empresas',
        description: 'RC Profissional + Patrimonial',
        grossValue: 2800,
        status: 'PAGO',
        dueDate: '2026-08-10',
        paidAt: '2026-08-10',
        recurrence: 'ANUAL',
        costCenterIdx: 5,
      },
      {
        category: 'Outros',
        provider: 'Contabilidade Exata',
        description: 'Honorários contábeis',
        grossValue: 1500,
        status: 'PENDENTE',
        dueDate: '2026-08-15',
        recurrence: 'MENSAL',
        costCenterIdx: 4,
      },
    ];

    for (const e of expenseData) {
      const expense = expenseRepo.create({
        clinicId,
        costCenterId: costCenters[e.costCenterIdx]?.id || costCenters[0].id,
        category: e.category,
        provider: e.provider,
        description: e.description,
        grossValue: e.grossValue,
        taxValue: 0,
        netValue: e.grossValue,
        paymentMethod: 'Transferência',
        status: e.status,
        dueDate: new Date(e.dueDate),
        paidAt: (e as any).paidAt ? new Date((e as any).paidAt) : null,
        recurrence: e.recurrence,
      });
      await expenseRepo.save(expense);
    }
    console.log(`✓ ${expenseData.length} despesas`);
  }

  // ── DOCTOR TRANSFERS ──────────────────────────────────────────────────────
  const existingTransfers = await transferRepo.count({ where: { clinicId } });
  if (existingTransfers === 0 && doctorIds.length > 0) {
    const transferData = [
      {
        doctorId: doctorIds[0],
        referenceMonth: '2026-07',
        totalRevenue: 6250,
        transferPercentage: 55,
        transferAmount: 3437.5,
        netTransfer: 3437.5,
        proceduresCount: 12,
        status: 'PAGO',
        paidAt: '2026-08-05',
      },
      {
        doctorId: doctorIds[1] || doctorIds[0],
        referenceMonth: '2026-07',
        totalRevenue: 4200,
        transferPercentage: 55,
        transferAmount: 2310,
        netTransfer: 2310,
        proceduresCount: 8,
        status: 'PAGO',
        paidAt: '2026-08-05',
      },
      {
        doctorId: doctorIds[0],
        referenceMonth: '2026-08',
        totalRevenue: 5300,
        transferPercentage: 55,
        transferAmount: 2915,
        netTransfer: 2915,
        proceduresCount: 10,
        status: 'CALCULADO',
      },
    ];

    for (const t of transferData) {
      const transfer = transferRepo.create({
        clinicId,
        doctorId: t.doctorId,
        referenceMonth: t.referenceMonth,
        totalRevenue: t.totalRevenue,
        transferPercentage: t.transferPercentage,
        transferAmount: t.transferAmount,
        deductions: 0,
        netTransfer: t.netTransfer,
        proceduresCount: t.proceduresCount,
        status: t.status,
        paidAt: (t as any).paidAt ? new Date((t as any).paidAt) : null,
      });
      await transferRepo.save(transfer);
    }
    console.log(`✓ ${transferData.length} repasses médicos`);
  }

  // ── CASHFLOW ──────────────────────────────────────────────────────────────
  const existingCashflow = await cashflowRepo.count({ where: { clinicId } });
  if (existingCashflow === 0) {
    const cashflowData = [
      {
        type: 'ENTRADA',
        sourceType: 'RECEITA',
        description: 'Consultas particulares - semana 1 Jul',
        value: 1050,
        date: '2026-07-06',
        category: 'Clínica Geral',
      },
      {
        type: 'ENTRADA',
        sourceType: 'RECEITA',
        description: 'Exames cardiologia - Jul',
        value: 2750,
        date: '2026-07-14',
        category: 'Cardiologia',
      },
      {
        type: 'SAIDA',
        sourceType: 'DESPESA',
        description: 'Aluguel Julho',
        value: 8500,
        date: '2026-07-05',
        category: 'Infraestrutura',
      },
      {
        type: 'SAIDA',
        sourceType: 'DESPESA',
        description: 'Folha Julho',
        value: 42000,
        date: '2026-07-30',
        category: 'Pessoal',
      },
      {
        type: 'SAIDA',
        sourceType: 'REPASSE',
        description: 'Repasse médico Jul - Admin',
        value: 3437.5,
        date: '2026-08-05',
        category: 'Repasse',
      },
      {
        type: 'ENTRADA',
        sourceType: 'RECEITA',
        description: 'Consultas + Exames - semana 1 Ago',
        value: 3050,
        date: '2026-08-07',
        category: 'Clínica Geral',
      },
      {
        type: 'SAIDA',
        sourceType: 'DESPESA',
        description: 'Aluguel + Condomínio Agosto',
        value: 10700,
        date: '2026-08-10',
        category: 'Infraestrutura',
      },
      {
        type: 'ENTRADA',
        sourceType: 'AJUSTE',
        description: 'Ajuste de saldo inicial',
        value: 25000,
        date: '2026-07-01',
        category: 'Ajuste',
      },
    ];

    for (const cf of cashflowData) {
      const entry = cashflowRepo.create({
        clinicId,
        type: cf.type,
        sourceType: cf.sourceType,
        description: cf.description,
        value: cf.value,
        date: new Date(cf.date),
        category: cf.category,
        reconciled: cf.sourceType !== 'AJUSTE',
      });
      await cashflowRepo.save(entry);
    }
    console.log(`✓ ${cashflowData.length} entradas de fluxo de caixa`);
  }

  console.log('─────────────────────────────────────────────────');
  console.log('Seed financeiro finalizado com sucesso!');
  console.log('─────────────────────────────────────────────────');

  if (shouldDestroyConnection && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  seedFinancial().catch(async (error) => {
    console.error('Erro ao executar seed financeiro:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  });
}
