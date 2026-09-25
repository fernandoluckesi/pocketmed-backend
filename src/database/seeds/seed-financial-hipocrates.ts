import 'reflect-metadata';
import 'dotenv/config';
import AppDataSource from '../data-source';
import { Clinic } from '../../entities/clinic.entity';
import { ClinicMembership } from '../../entities/clinic-membership.entity';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { FinancialSettings } from '../../entities/financial-settings.entity';
import { FinancialCostCenter } from '../../entities/financial-cost-center.entity';
import { FinancialConvenio } from '../../entities/financial-convenio.entity';
import { FinancialRevenue } from '../../entities/financial-revenue.entity';
import { FinancialExpense } from '../../entities/financial-expense.entity';
import { FinancialDoctorTransfer } from '../../entities/financial-doctor-transfer.entity';
import { FinancialCashflowEntry } from '../../entities/financial-cashflow-entry.entity';

/**
 * Large, realistic financial dataset for an existing clinic (by name),
 * built from its REAL completed appointments (same doctors/patients/dates
 * already in the system) instead of hand-typed rows — so the whole
 * financial flow (receitas → repasses → fluxo de caixa) is exercisable
 * end to end with data that's internally consistent.
 *
 * Usage: CLINIC_NAME="Clínica Hipócrates" npm run seed:financial:clinic
 * (defaults to "Clínica Hipócrates" if CLINIC_NAME isn't set)
 */

const TARGET_CLINIC_NAME = process.env.CLINIC_NAME || 'Clínica Hipócrates';

type Procedure = { name: string; price: number };

const PROCEDURES_BY_SPECIALTY: Record<string, Procedure[]> = {
  'Clínica Geral': [
    { name: 'Consulta Clínica Geral', price: 300 },
    { name: 'Consulta de Retorno', price: 180 },
    { name: 'Check-up Executivo', price: 1500 },
  ],
  Cardiologia: [
    { name: 'Consulta Cardiológica', price: 420 },
    { name: 'Eletrocardiograma', price: 220 },
    { name: 'Ecocardiograma', price: 480 },
    { name: 'Teste Ergométrico', price: 380 },
    { name: 'MAPA 24h', price: 300 },
    { name: 'Holter 24h', price: 280 },
  ],
  Neurologia: [
    { name: 'Consulta Neurológica', price: 450 },
    { name: 'Eletroencefalograma', price: 400 },
    { name: 'Consulta de Retorno', price: 220 },
  ],
  Pediatria: [
    { name: 'Consulta Pediátrica', price: 320 },
    { name: 'Puericultura', price: 280 },
    { name: 'Consulta de Retorno', price: 160 },
  ],
  Ortopedia: [
    { name: 'Consulta Ortopédica', price: 380 },
    { name: 'Infiltração Articular', price: 550 },
    { name: 'Consulta de Retorno', price: 200 },
  ],
  Dermatologia: [
    { name: 'Consulta Dermatológica', price: 380 },
    { name: 'Biópsia de Pele', price: 650 },
    { name: 'Crioterapia', price: 280 },
  ],
  Endocrinologia: [
    { name: 'Consulta Endocrinológica', price: 420 },
    { name: 'Consulta de Retorno', price: 220 },
  ],
  Ginecologia: [
    { name: 'Consulta Ginecológica', price: 400 },
    { name: 'Papanicolau', price: 220 },
    { name: 'Ultrassom Transvaginal', price: 380 },
  ],
  Pneumologia: [
    { name: 'Consulta Pneumológica', price: 400 },
    { name: 'Espirometria', price: 280 },
    { name: 'Consulta de Retorno', price: 200 },
  ],
  Oftalmologia: [
    { name: 'Consulta Oftalmológica', price: 320 },
    { name: 'Mapeamento de Retina', price: 380 },
    { name: 'Tonometria', price: 160 },
  ],
};
const DEFAULT_PROCEDURES: Procedure[] = [{ name: 'Consulta', price: 300 }];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedPick<T>(entries: [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of entries) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function seedFinancialForClinic(clinicName: string = TARGET_CLINIC_NAME) {
  const shouldDestroyConnection = !AppDataSource.isInitialized;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const clinicRepo = AppDataSource.getRepository(Clinic);
  const membershipRepo = AppDataSource.getRepository(ClinicMembership);
  const appointmentRepo = AppDataSource.getRepository(Appointment);
  const settingsRepo = AppDataSource.getRepository(FinancialSettings);
  const costCenterRepo = AppDataSource.getRepository(FinancialCostCenter);
  const convenioRepo = AppDataSource.getRepository(FinancialConvenio);
  const revenueRepo = AppDataSource.getRepository(FinancialRevenue);
  const expenseRepo = AppDataSource.getRepository(FinancialExpense);
  const transferRepo = AppDataSource.getRepository(FinancialDoctorTransfer);
  const cashflowRepo = AppDataSource.getRepository(FinancialCashflowEntry);

  const clinic = await clinicRepo.findOne({ where: { name: clinicName } });
  if (!clinic) {
    console.log(`⚠️  Clínica "${clinicName}" não encontrada.`);
    return;
  }
  const clinicId = clinic.id;

  const memberships = await membershipRepo.find({ where: { clinicId, isActive: true } });
  const adminMembership = memberships.find((m) => m.role === 'admin');
  const doctorIds = memberships.map((m) => m.professionalId);

  console.log(`── Seed Financeiro para: ${clinic.name} (${doctorIds.length} médicos) ──`);

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
      bankAccount: '78901-2',
      pixKey: clinic.cnpj || 'financeiro@hipocrates.com.br',
      invoicePrefix: 'HIP',
    });
    await settingsRepo.save(settings);
    console.log('✓ Settings financeiras criadas');
  } else {
    console.log('· Settings já existiam, mantidas');
  }
  const transferPct = Number(settings.defaultDoctorTransferPercentage) || 55;

  // ── COST CENTERS ──────────────────────────────────────────────────────────
  const costCentersData = [
    {
      name: 'Folha de Pagamento',
      code: 'CC001',
      budgetAllocated: 4000,
      color: '#2563EB',
      description: 'Recepção, enfermagem e administrativo',
    },
    {
      name: 'Infraestrutura Predial',
      code: 'CC002',
      budgetAllocated: 4500,
      color: '#10B981',
      description: 'Aluguel, condomínio, água, energia e IPTU',
    },
    {
      name: 'Insumos Médicos',
      code: 'CC003',
      budgetAllocated: 1500,
      color: '#8B5CF6',
      description: 'Material descartável e medicamentos',
    },
    {
      name: 'Marketing e Comunicação',
      code: 'CC004',
      budgetAllocated: 1000,
      color: '#EC4899',
      description: 'Publicidade, site e redes sociais',
    },
    {
      name: 'Tecnologia e SaaS',
      code: 'CC005',
      budgetAllocated: 900,
      color: '#F59E0B',
      description: 'Sistemas, licenças e infraestrutura de TI',
    },
    {
      name: 'Seguros e Compliance',
      code: 'CC006',
      budgetAllocated: 1500,
      color: '#6B7280',
      description: 'Seguro do imóvel, RC profissional, contabilidade',
    },
  ];

  const costCenters: Record<string, FinancialCostCenter> = {};
  for (const cc of costCentersData) {
    let existing = await costCenterRepo.findOne({ where: { clinicId, code: cc.code } });
    if (!existing) {
      existing = costCenterRepo.create({ ...cc, clinicId, active: true });
      existing = await costCenterRepo.save(existing);
    }
    costCenters[cc.code] = existing;
  }
  console.log(`✓ ${Object.keys(costCenters).length} centros de custo`);

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

  const today = new Date();

  // ── REVENUES (one per real completed appointment) ──────────────────────────
  const existingRevenues = await revenueRepo.count({ where: { clinicId } });
  const revenuesByDoctorMonth = new Map<string, { total: number; count: number }>();

  if (existingRevenues === 0) {
    const appointments = await appointmentRepo.find({
      where: { status: AppointmentStatus.COMPLETED },
      order: { dateTime: 'ASC' },
    });
    const clinicAppointments = appointments.filter((a) => doctorIds.includes(a.doctorId || ''));

    let created = 0;
    for (const apt of clinicAppointments) {
      const specialty = apt.doctorSpecialty || 'Clínica Geral';
      const procedures = PROCEDURES_BY_SPECIALTY[specialty] || DEFAULT_PROCEDURES;
      const procedure = pick(procedures);
      const basePrice = procedure.price * (0.92 + Math.random() * 0.16);

      const paymentMethod = weightedPick<string>([
        ['PIX', 32],
        ['Cartão Crédito', 24],
        ['Cartão Débito', 10],
        ['Dinheiro', 10],
        ['Convênio', 24],
      ]);
      const isConvenio = paymentMethod === 'Convênio';
      const convenio = isConvenio ? pick(convenios) : null;

      // Convênio revenue follows THAT operator's contracted payment term
      // (30/45/60 dias) and glosa tolerance — it isn't paid same-day like
      // PIX/cartão/dinheiro. Each operator's markup (when negotiated above
      // TUSS/CBHPM table) also adjusts the billed value.
      const grossValue = round2(
        basePrice *
          (1 + (convenio?.markupPercentage ? Number(convenio.markupPercentage) / 100 : 0)),
      );
      const dueDate = convenio ? addDays(apt.dateTime, convenio.paymentTerm) : apt.dateTime;
      const termAlreadyDue = dueDate < today;

      let status: 'PAGO' | 'PENDENTE' | 'GLOSADO' | 'FATURADO';
      if (isConvenio) {
        if (!termAlreadyDue) {
          // Still within the operator's contracted payment window — billed,
          // not yet resolved either way.
          status = 'FATURADO';
        } else {
          // Higher glosaTolerance ⇒ that operator rejects more guides.
          const glosaChance = Math.min(15, Number(convenio?.glosaTolerance || 2) * 3);
          status = weightedPick<'PAGO' | 'PENDENTE' | 'GLOSADO'>([
            ['PAGO', 100 - glosaChance - 6],
            ['GLOSADO', glosaChance],
            ['PENDENTE', 6],
          ]);
        }
      } else {
        status = weightedPick<'PAGO' | 'PENDENTE'>([
          ['PAGO', 85],
          ['PENDENTE', 15],
        ]);
      }

      const glosaValue = status === 'GLOSADO' ? grossValue : null;
      const glosaReason =
        status === 'GLOSADO'
          ? pick(['Guia vencida', 'Divergência de tabela', 'Falta de autorização prévia'])
          : null;
      const netValue = status === 'GLOSADO' ? 0 : grossValue;
      // Convênios settle a few days into their own term window; particular
      // payments are collected same-day (PIX/cartão/dinheiro at check-out).
      const paidAt =
        status === 'PAGO'
          ? isConvenio
            ? addDays(dueDate, Math.floor(Math.random() * 6))
            : apt.dateTime
          : null;

      const revenue = revenueRepo.create({
        clinicId,
        patientId: apt.patientId || null,
        doctorId: apt.doctorId || null,
        appointmentId: apt.id,
        convenioId: convenio?.id || null,
        procedure: procedure.name,
        specialty,
        grossValue,
        discountValue: 0,
        netValue,
        paymentMethod,
        status,
        dueDate,
        paidAt,
        glosaValue,
        glosaReason,
      });
      await revenueRepo.save(revenue);
      created++;

      // Track per-doctor/month totals (paid or billed revenue only) for
      // transfers — grouped by dueDate's month, since that's when the
      // clinic actually recognizes/bills the revenue (a convênio's
      // 30-60 day term can push it into a later month than the visit).
      if (apt.doctorId && (status === 'PAGO' || status === 'FATURADO')) {
        const key = `${apt.doctorId}|${monthKey(dueDate)}`;
        const bucket = revenuesByDoctorMonth.get(key) || { total: 0, count: 0 };
        bucket.total += netValue;
        bucket.count += 1;
        revenuesByDoctorMonth.set(key, bucket);
      }
    }
    console.log(`✓ ${created} receitas (a partir de consultas reais concluídas)`);
  } else {
    console.log(`· ${existingRevenues} receitas já existiam, mantidas`);
    // Recompute from the DB so the transfers step below still sees them.
    const paidOrBilled = await revenueRepo.find({ where: { clinicId } });
    for (const r of paidOrBilled) {
      if (!r.doctorId || (r.status !== 'PAGO' && r.status !== 'FATURADO')) continue;
      const key = `${r.doctorId}|${monthKey(new Date(r.dueDate))}`;
      const bucket = revenuesByDoctorMonth.get(key) || { total: 0, count: 0 };
      bucket.total += Number(r.netValue);
      bucket.count += 1;
      revenuesByDoctorMonth.set(key, bucket);
    }
  }

  // ── EXPENSES (recurring, Apr–Sep/2026) ──────────────────────────────────────
  const existingExpenses = await expenseRepo.count({ where: { clinicId } });
  const expensesByMonth = new Map<string, number>();

  if (existingExpenses === 0) {
    const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    const monthlyTemplates: Array<{
      category: string;
      provider: string;
      description: string;
      value: number;
      day: number;
      costCenter: string;
    }> = [
      {
        category: 'Folha de Pagamento',
        provider: 'Departamento Pessoal',
        description: 'Salários e encargos — recepção e enfermagem',
        value: 2200,
        day: 30,
        costCenter: 'CC001',
      },
      {
        category: 'Aluguel',
        provider: 'Imobiliária Central SP',
        description: 'Aluguel da sede da clínica',
        value: 1800,
        day: 5,
        costCenter: 'CC002',
      },
      {
        category: 'Condomínio',
        provider: 'Imobiliária Central SP',
        description: 'Condomínio predial',
        value: 380,
        day: 5,
        costCenter: 'CC002',
      },
      {
        category: 'Energia',
        provider: 'Enel Distribuição SP',
        description: 'Conta de energia elétrica',
        value: 320,
        day: 15,
        costCenter: 'CC002',
      },
      {
        category: 'Água',
        provider: 'Sabesp',
        description: 'Conta de água e esgoto',
        value: 100,
        day: 15,
        costCenter: 'CC002',
      },
      {
        category: 'Insumos',
        provider: 'MedSupply Brasil',
        description: 'Luvas, seringas, algodão, álcool e material descartável',
        value: 450,
        day: 8,
        costCenter: 'CC003',
      },
      {
        category: 'Insumos',
        provider: 'Cirúrgica Fernandes',
        description: 'Material de curativo e insumos de procedimento',
        value: 220,
        day: 22,
        costCenter: 'CC003',
      },
      {
        category: 'Marketing',
        provider: 'Ativa Digital Clinic',
        description: 'Google Ads + Meta Ads + gestão de redes sociais',
        value: 400,
        day: 1,
        costCenter: 'CC004',
      },
      {
        category: 'Tecnologia',
        provider: 'Hispora SaaS',
        description: 'Assinatura plataforma Hispora — Plano Plus',
        value: 299,
        day: 1,
        costCenter: 'CC005',
      },
      {
        category: 'Tecnologia',
        provider: 'AWS Cloud Services',
        description: 'Hospedagem, backups e infraestrutura',
        value: 70,
        day: 5,
        costCenter: 'CC005',
      },
      {
        category: 'Outros',
        provider: 'Contabilidade Exata',
        description: 'Honorários contábeis mensais',
        value: 350,
        day: 10,
        costCenter: 'CC006',
      },
      {
        category: 'Manutenção',
        provider: 'Limpa Bem Facilities',
        description: 'Limpeza e manutenção predial',
        value: 180,
        day: 12,
        costCenter: 'CC002',
      },
    ];

    let created = 0;
    for (const monthStr of months) {
      const [year, month] = monthStr.split('-').map(Number);
      for (const tpl of monthlyTemplates) {
        const dueDate = new Date(year, month - 1, tpl.day);
        const isPast = dueDate < today;
        const status = isPast ? 'PAGO' : Math.random() < 0.4 ? 'PAGO' : 'PENDENTE';
        const paidAt = status === 'PAGO' ? addDays(dueDate, Math.floor(Math.random() * 3)) : null;
        const value = round2(tpl.value * (0.95 + Math.random() * 0.1));

        const expense = expenseRepo.create({
          clinicId,
          costCenterId: costCenters[tpl.costCenter].id,
          category: tpl.category,
          provider: tpl.provider,
          description: `${tpl.description} — ${monthStr}`,
          grossValue: value,
          taxValue: 0,
          netValue: value,
          paymentMethod: 'Transferência',
          status,
          dueDate,
          paidAt,
          recurrence: 'MENSAL',
        });
        await expenseRepo.save(expense);
        created++;

        if (status === 'PAGO' && paidAt) {
          const key = monthKey(paidAt);
          expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + value);
        }
      }
    }

    // A couple of one-off / annual expenses for realism.
    const oneOffs = [
      {
        category: 'Seguros',
        provider: 'Porto Seguro Empresas',
        description: 'Apólice anual — RC Profissional + Patrimonial',
        value: 2200,
        date: new Date(2026, 3, 10),
        costCenter: 'CC006',
        recurrence: 'ANUAL',
      },
      {
        category: 'Outros',
        provider: 'Prefeitura de São Paulo',
        description: 'IPTU — cota única',
        value: 1500,
        date: new Date(2026, 3, 30),
        costCenter: 'CC002',
        recurrence: 'ANUAL',
      },
      {
        category: 'Infraestrutura',
        provider: 'Móveis & Cia Clínico',
        description: 'Reforma da recepção e novas cadeiras de espera',
        value: 3200,
        date: new Date(2026, 5, 18),
        costCenter: 'CC002',
        recurrence: 'UNICA',
      },
      {
        category: 'Tecnologia',
        provider: 'MedEquip Diagnósticos',
        description: 'Aquisição de eletrocardiógrafo portátil',
        value: 2600,
        date: new Date(2026, 4, 22),
        costCenter: 'CC005',
        recurrence: 'UNICA',
      },
    ];
    for (const oo of oneOffs) {
      const isPast = oo.date < today;
      const paidAt = isPast ? addDays(oo.date, 2) : null;
      const expense = expenseRepo.create({
        clinicId,
        costCenterId: costCenters[oo.costCenter].id,
        category: oo.category,
        provider: oo.provider,
        description: oo.description,
        grossValue: oo.value,
        taxValue: 0,
        netValue: oo.value,
        paymentMethod: 'Transferência',
        status: isPast ? 'PAGO' : 'PENDENTE',
        dueDate: oo.date,
        paidAt,
        recurrence: oo.recurrence,
      });
      await expenseRepo.save(expense);
      created++;
      if (isPast && paidAt) {
        const key = monthKey(paidAt);
        expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + oo.value);
      }
    }

    console.log(`✓ ${created} despesas (abr–set/2026, recorrentes + avulsas)`);
  } else {
    console.log(`· ${existingExpenses} despesas já existiam, mantidas`);
    // Recompute from the DB so the cashflow step below still sees them
    // (expensesByMonth is only populated inline when rows are freshly created).
    const paidExpenses = await expenseRepo.find({ where: { clinicId, status: 'PAGO' } });
    for (const e of paidExpenses) {
      if (!e.paidAt) continue;
      const key = monthKey(new Date(e.paidAt));
      expensesByMonth.set(key, (expensesByMonth.get(key) || 0) + Number(e.grossValue));
    }
  }

  // ── DOCTOR TRANSFERS (computed from the seeded revenue) ─────────────────────
  const existingTransfers = await transferRepo.count({ where: { clinicId } });
  const transfersByMonth = new Map<string, number>();

  if (existingTransfers === 0 && revenuesByDoctorMonth.size > 0) {
    let created = 0;
    for (const [key, bucket] of revenuesByDoctorMonth.entries()) {
      const [doctorId, refMonth] = key.split('|');
      // The clinic's owner doesn't take a percentage "repasse" from themself.
      if (adminMembership && doctorId === adminMembership.professionalId) continue;

      const transferAmount = round2(bucket.total * (transferPct / 100));
      const [year, month] = refMonth.split('-').map(Number);
      const isPastMonth = new Date(year, month, 5) < today; // paid ~5th of the following month

      const transfer = transferRepo.create({
        clinicId,
        doctorId,
        referenceMonth: refMonth,
        totalRevenue: round2(bucket.total),
        transferPercentage: transferPct,
        transferAmount,
        deductions: 0,
        netTransfer: transferAmount,
        proceduresCount: bucket.count,
        status: isPastMonth ? 'PAGO' : 'CALCULADO',
        paidAt: isPastMonth ? new Date(year, month, 5) : null,
      });
      await transferRepo.save(transfer);
      created++;

      if (isPastMonth) {
        const paidMonthKey = monthKey(new Date(year, month, 5));
        transfersByMonth.set(
          paidMonthKey,
          (transfersByMonth.get(paidMonthKey) || 0) + transferAmount,
        );
      }
    }
    console.log(`✓ ${created} repasses médicos (calculados a partir das receitas)`);
  } else {
    console.log(`· ${existingTransfers} repasses já existiam, mantidos`);
    // Recompute from the DB so the cashflow step below still sees them.
    const paidTransfers = await transferRepo.find({ where: { clinicId, status: 'PAGO' } });
    for (const t of paidTransfers) {
      if (!t.paidAt) continue;
      const key = monthKey(new Date(t.paidAt));
      transfersByMonth.set(key, (transfersByMonth.get(key) || 0) + Number(t.netTransfer));
    }
  }

  // ── CASHFLOW (monthly aggregates, chronological running balance) ───────────
  const existingCashflow = await cashflowRepo.count({ where: { clinicId } });
  if (existingCashflow === 0) {
    // Recompute paid revenue per month directly (independent of the transfer
    // loop above, which only tracked PAGO/FATURADO for transfer purposes).
    const paidRevenueByMonth = new Map<string, number>();
    const allRevenues = await revenueRepo.find({ where: { clinicId } });
    for (const r of allRevenues) {
      if (r.status === 'PAGO' && r.paidAt) {
        const key = monthKey(new Date(r.paidAt));
        paidRevenueByMonth.set(key, (paidRevenueByMonth.get(key) || 0) + Number(r.netValue));
      }
    }

    type RawEntry = {
      type: 'ENTRADA' | 'SAIDA';
      sourceType: string;
      description: string;
      value: number;
      date: Date;
      category: string;
      reconciled: boolean;
    };
    const entries: RawEntry[] = [];

    entries.push({
      type: 'ENTRADA',
      sourceType: 'AJUSTE',
      description: 'Saldo inicial de caixa',
      value: 40000,
      date: new Date(2026, 3, 1),
      category: 'Ajuste',
      reconciled: true,
    });

    const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    for (const m of months) {
      const [year, month] = m.split('-').map(Number);
      const revTotal = paidRevenueByMonth.get(m);
      if (revTotal) {
        entries.push({
          type: 'ENTRADA',
          sourceType: 'RECEITA',
          description: `Receitas recebidas — ${m}`,
          value: round2(revTotal),
          date: new Date(year, month - 1, 27),
          category: 'Receitas Médicas',
          reconciled: new Date(year, month - 1, 27) < today,
        });
      }

      const expTotal = expensesByMonth.get(m);
      if (expTotal) {
        entries.push({
          type: 'SAIDA',
          sourceType: 'DESPESA',
          description: `Despesas pagas — ${m}`,
          value: round2(expTotal),
          date: new Date(year, month - 1, 28),
          category: 'Despesas Operacionais',
          reconciled: new Date(year, month - 1, 28) < today,
        });
      }

      const transferTotal = transfersByMonth.get(m);
      if (transferTotal) {
        entries.push({
          type: 'SAIDA',
          sourceType: 'REPASSE',
          description: `Repasses médicos pagos — ${m}`,
          value: round2(transferTotal),
          date: new Date(year, month - 1, 5),
          category: 'Repasse Médico',
          reconciled: new Date(year, month - 1, 5) < today,
        });
      }
    }

    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    let created = 0;
    for (const e of entries) {
      balance += e.type === 'ENTRADA' ? e.value : -e.value;
      const entry = cashflowRepo.create({
        clinicId,
        type: e.type,
        sourceType: e.sourceType,
        description: e.description,
        value: e.value,
        date: e.date,
        category: e.category,
        balanceAfter: round2(balance),
        reconciled: e.reconciled,
      });
      await cashflowRepo.save(entry);
      created++;
    }
    console.log(
      `✓ ${created} entradas de fluxo de caixa (saldo final: R$ ${round2(balance).toLocaleString('pt-BR')})`,
    );
  } else {
    console.log(`· ${existingCashflow} entradas de fluxo de caixa já existiam, mantidas`);
  }

  console.log('─────────────────────────────────────────────────');
  console.log(`Seed financeiro finalizado para "${clinic.name}"!`);
  console.log('─────────────────────────────────────────────────');

  if (shouldDestroyConnection && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  seedFinancialForClinic().catch(async (error) => {
    console.error('Erro ao executar seed financeiro:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  });
}
