import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, FindOptionsWhere } from 'typeorm';
import { FinancialSettings } from '../entities/financial-settings.entity';
import { FinancialCostCenter } from '../entities/financial-cost-center.entity';
import { FinancialConvenio } from '../entities/financial-convenio.entity';
import { FinancialRevenue } from '../entities/financial-revenue.entity';
import { FinancialExpense } from '../entities/financial-expense.entity';
import { FinancialDoctorTransfer } from '../entities/financial-doctor-transfer.entity';
import { FinancialCashflowEntry } from '../entities/financial-cashflow-entry.entity';

@Injectable()
export class FinancialService {
  constructor(
    @InjectRepository(FinancialSettings)
    private readonly settingsRepo: Repository<FinancialSettings>,
    @InjectRepository(FinancialCostCenter)
    private readonly costCenterRepo: Repository<FinancialCostCenter>,
    @InjectRepository(FinancialConvenio)
    private readonly convenioRepo: Repository<FinancialConvenio>,
    @InjectRepository(FinancialRevenue)
    private readonly revenueRepo: Repository<FinancialRevenue>,
    @InjectRepository(FinancialExpense)
    private readonly expenseRepo: Repository<FinancialExpense>,
    @InjectRepository(FinancialDoctorTransfer)
    private readonly transferRepo: Repository<FinancialDoctorTransfer>,
    @InjectRepository(FinancialCashflowEntry)
    private readonly cashflowRepo: Repository<FinancialCashflowEntry>,
  ) {}

  // ─── SETTINGS ───────────────────────────────────────────────────────────────

  async getSettings(clinicId: string) {
    let settings = await this.settingsRepo.findOne({ where: { clinicId } });
    if (!settings) {
      const newSettings = this.settingsRepo.create({
        clinicId,
        taxRegime: 'SIMPLES_NACIONAL',
        issRate: 5.0,
        dasRate: 6.0,
        irpjRate: 0,
        csllRate: 0,
        defaultDoctorTransferPercentage: 50.0,
      });
      settings = await this.settingsRepo.save(newSettings);
    }
    return settings;
  }

  async updateSettings(clinicId: string, dto: any) {
    const settings = await this.getSettings(clinicId);
    Object.assign(settings, dto);
    settings.clinicId = clinicId;
    return this.settingsRepo.save(settings);
  }

  // ─── COST CENTERS ──────────────────────────────────────────────────────────

  async listCostCenters(clinicId: string) {
    return this.costCenterRepo.find({
      where: { clinicId, active: true },
      order: { name: 'ASC' },
    });
  }

  async createCostCenter(clinicId: string, dto: any) {
    const existing = await this.costCenterRepo.findOne({
      where: { clinicId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException('Cost center code already exists');
    }
    const costCenter = this.costCenterRepo.create({ ...dto, clinicId });
    return this.costCenterRepo.save(costCenter);
  }

  async updateCostCenter(clinicId: string, id: string, dto: any) {
    const costCenter = await this.costCenterRepo.findOne({ where: { id, clinicId } });
    if (!costCenter) {
      throw new NotFoundException('Cost center not found');
    }
    if (dto.code && dto.code !== costCenter.code) {
      const existing = await this.costCenterRepo.findOne({
        where: { clinicId, code: dto.code },
      });
      if (existing) {
        throw new ConflictException('Cost center code already exists');
      }
    }
    Object.assign(costCenter, dto);
    return this.costCenterRepo.save(costCenter);
  }

  async deleteCostCenter(clinicId: string, id: string) {
    const costCenter = await this.costCenterRepo.findOne({ where: { id, clinicId } });
    if (!costCenter) {
      throw new NotFoundException('Cost center not found');
    }
    costCenter.active = false;
    await this.costCenterRepo.save(costCenter);
  }

  // ─── CONVENIOS ─────────────────────────────────────────────────────────────

  async listConvenios(clinicId: string) {
    return this.convenioRepo.find({
      where: { clinicId },
      order: { name: 'ASC' },
    });
  }

  async createConvenio(clinicId: string, dto: any) {
    const existing = await this.convenioRepo.findOne({
      where: { clinicId, ansCode: dto.ansCode },
    });
    if (existing) {
      throw new ConflictException('ANS code already exists for this clinic');
    }
    const convenio = this.convenioRepo.create({ ...dto, clinicId });
    return this.convenioRepo.save(convenio);
  }

  async updateConvenio(clinicId: string, id: string, dto: any) {
    const convenio = await this.convenioRepo.findOne({ where: { id, clinicId } });
    if (!convenio) {
      throw new NotFoundException('Convenio not found');
    }
    if (dto.ansCode && dto.ansCode !== convenio.ansCode) {
      const existing = await this.convenioRepo.findOne({
        where: { clinicId, ansCode: dto.ansCode },
      });
      if (existing) {
        throw new ConflictException('ANS code already exists for this clinic');
      }
    }
    Object.assign(convenio, dto);
    return this.convenioRepo.save(convenio);
  }

  async toggleConvenio(clinicId: string, id: string) {
    const convenio = await this.convenioRepo.findOne({ where: { id, clinicId } });
    if (!convenio) {
      throw new NotFoundException('Convenio not found');
    }
    convenio.active = !convenio.active;
    return this.convenioRepo.save(convenio);
  }

  async deleteConvenio(clinicId: string, id: string) {
    const convenio = await this.convenioRepo.findOne({ where: { id, clinicId } });
    if (!convenio) {
      throw new NotFoundException('Convenio not found');
    }
    const linkedRevenues = await this.revenueRepo.count({
      where: { clinicId, convenioId: id },
    });
    if (linkedRevenues > 0) {
      throw new BadRequestException('Cannot delete convenio with linked revenues');
    }
    await this.convenioRepo.remove(convenio);
  }

  // ─── REVENUES ──────────────────────────────────────────────────────────────

  async listRevenues(
    clinicId: string,
    filters: {
      status?: string;
      doctorId?: string;
      convenioId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: FindOptionsWhere<FinancialRevenue> = { clinicId };

    if (filters.status) where.status = filters.status;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.convenioId) where.convenioId = filters.convenioId;
    if (filters.startDate && filters.endDate) {
      where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate)) as any;
    } else if (filters.startDate) {
      where.dueDate = MoreThanOrEqual(new Date(filters.startDate)) as any;
    } else if (filters.endDate) {
      where.dueDate = LessThanOrEqual(new Date(filters.endDate)) as any;
    }

    const [data, total] = await this.revenueRepo.findAndCount({
      where,
      relations: ['convenio'],
      order: { dueDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getRevenueSummary(clinicId: string) {
    const revenues = await this.revenueRepo.find({ where: { clinicId } });
    const summary: Record<string, number> = {
      PENDENTE: 0,
      FATURADO: 0,
      PAGO: 0,
      GLOSADO: 0,
      CANCELADO: 0,
      total: 0,
    };
    for (const rev of revenues) {
      const val = Number(rev.netValue) || 0;
      summary[rev.status] = (summary[rev.status] || 0) + val;
      summary.total += val;
    }
    return summary;
  }

  async createRevenue(clinicId: string, dto: any) {
    const grossValue = Number(dto.grossValue) || 0;
    const discountValue = Number(dto.discountValue) || 0;
    const netValue = grossValue - discountValue;
    const revenue = this.revenueRepo.create({
      ...dto,
      clinicId,
      grossValue,
      discountValue,
      netValue,
      status: dto.status || 'PENDENTE',
    });
    return this.revenueRepo.save(revenue);
  }

  async updateRevenue(clinicId: string, id: string, dto: any) {
    const revenue = await this.revenueRepo.findOne({ where: { id, clinicId } });
    if (!revenue) {
      throw new NotFoundException('Revenue not found');
    }
    Object.assign(revenue, dto);
    if (dto.grossValue !== undefined || dto.discountValue !== undefined) {
      const grossValue = Number(revenue.grossValue) || 0;
      const discountValue = Number(revenue.discountValue) || 0;
      revenue.netValue = grossValue - discountValue;
    }
    return this.revenueRepo.save(revenue);
  }

  async updateRevenueStatus(
    clinicId: string,
    id: string,
    status: string,
    glosaValue?: number,
    glosaReason?: string,
  ) {
    const revenue = await this.revenueRepo.findOne({ where: { id, clinicId } });
    if (!revenue) {
      throw new NotFoundException('Revenue not found');
    }
    revenue.status = status;
    if (status === 'GLOSADO' && glosaValue !== undefined) {
      revenue.glosaValue = glosaValue;
      revenue.glosaReason = glosaReason || null;
    }
    if (status === 'PAGO') {
      revenue.paidAt = new Date();
      // Create cashflow ENTRADA entry
      const entry = this.cashflowRepo.create({
        clinicId,
        type: 'ENTRADA',
        sourceType: 'RECEITA',
        sourceId: revenue.id,
        description: `Receita: ${revenue.procedure}`,
        value: Number(revenue.netValue),
        date: new Date(),
        category: revenue.specialty,
      });
      await this.cashflowRepo.save(entry);
    }
    return this.revenueRepo.save(revenue);
  }

  async deleteRevenue(clinicId: string, id: string) {
    const revenue = await this.revenueRepo.findOne({ where: { id, clinicId } });
    if (!revenue) {
      throw new NotFoundException('Revenue not found');
    }
    if (revenue.status !== 'PENDENTE') {
      throw new BadRequestException('Only PENDENTE revenues can be deleted');
    }
    await this.revenueRepo.remove(revenue);
  }

  // ─── EXPENSES ──────────────────────────────────────────────────────────────

  async listExpenses(
    clinicId: string,
    filters: {
      status?: string;
      category?: string;
      costCenterId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: FindOptionsWhere<FinancialExpense> = { clinicId };

    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.costCenterId) where.costCenterId = filters.costCenterId;
    if (filters.startDate && filters.endDate) {
      where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate)) as any;
    } else if (filters.startDate) {
      where.dueDate = MoreThanOrEqual(new Date(filters.startDate)) as any;
    } else if (filters.endDate) {
      where.dueDate = LessThanOrEqual(new Date(filters.endDate)) as any;
    }

    const [data, total] = await this.expenseRepo.findAndCount({
      where,
      relations: ['costCenter'],
      order: { dueDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getExpenseSummary(clinicId: string) {
    const expenses = await this.expenseRepo.find({ where: { clinicId } });
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let total = 0;

    for (const exp of expenses) {
      const val = Number(exp.netValue) || 0;
      byCategory[exp.category] = (byCategory[exp.category] || 0) + val;
      byStatus[exp.status] = (byStatus[exp.status] || 0) + val;
      total += val;
    }

    return { byCategory, byStatus, total };
  }

  async createExpense(clinicId: string, dto: any) {
    const grossValue = Number(dto.grossValue) || 0;
    const taxValue = Number(dto.taxValue) || 0;
    const netValue = grossValue + taxValue;
    const expense = this.expenseRepo.create({
      ...dto,
      clinicId,
      grossValue,
      taxValue,
      netValue,
      status: dto.status || 'PENDENTE',
    });
    return this.expenseRepo.save(expense);
  }

  async updateExpense(clinicId: string, id: string, dto: any) {
    const expense = await this.expenseRepo.findOne({ where: { id, clinicId } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    Object.assign(expense, dto);
    if (dto.grossValue !== undefined || dto.taxValue !== undefined) {
      const grossValue = Number(expense.grossValue) || 0;
      const taxValue = Number(expense.taxValue) || 0;
      expense.netValue = grossValue + taxValue;
    }
    return this.expenseRepo.save(expense);
  }

  async payExpense(clinicId: string, id: string) {
    const expense = await this.expenseRepo.findOne({ where: { id, clinicId } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    expense.status = 'PAGO';
    expense.paidAt = new Date();

    // Create cashflow SAIDA entry
    const entry = this.cashflowRepo.create({
      clinicId,
      type: 'SAIDA',
      sourceType: 'DESPESA',
      sourceId: expense.id,
      description: `Despesa: ${expense.provider} - ${expense.category}`,
      value: Number(expense.netValue),
      date: new Date(),
      category: expense.category,
    });
    await this.cashflowRepo.save(entry);

    return this.expenseRepo.save(expense);
  }

  async deleteExpense(clinicId: string, id: string) {
    const expense = await this.expenseRepo.findOne({ where: { id, clinicId } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    if (expense.status !== 'PENDENTE') {
      throw new BadRequestException('Only PENDENTE expenses can be deleted');
    }
    await this.expenseRepo.remove(expense);
  }


  // ─── DOCTOR TRANSFERS ──────────────────────────────────────────────────────

  async listTransfers(
    clinicId: string,
    filters: { month?: string; doctorId?: string; status?: string },
  ) {
    const where: FindOptionsWhere<FinancialDoctorTransfer> = { clinicId };
    if (filters.month) where.referenceMonth = filters.month;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.status) where.status = filters.status;

    return this.transferRepo.find({
      where,
      order: { referenceMonth: 'DESC', createdAt: 'DESC' },
    });
  }

  async calculateTransfers(clinicId: string, month: string) {
    const settings = await this.getSettings(clinicId);

    // Get all PAGO revenues for the month
    const startDate = new Date(`${month}-01`);
    const endDate = new Date(`${month}-31`);
    const revenues = await this.revenueRepo.find({
      where: {
        clinicId,
        status: 'PAGO',
        dueDate: Between(startDate, endDate) as any,
      },
    });

    // Group by doctor
    const doctorMap: Record<string, { total: number; count: number }> = {};
    for (const rev of revenues) {
      if (!rev.doctorId) continue;
      if (!doctorMap[rev.doctorId]) {
        doctorMap[rev.doctorId] = { total: 0, count: 0 };
      }
      doctorMap[rev.doctorId].total += Number(rev.netValue) || 0;
      doctorMap[rev.doctorId].count += 1;
    }

    const percentage = Number(settings.defaultDoctorTransferPercentage) || 50;
    const results = Object.entries(doctorMap).map(([doctorId, data]) => {
      const transferAmount = (data.total * percentage) / 100;
      return {
        doctorId,
        referenceMonth: month,
        totalRevenue: data.total,
        transferPercentage: percentage,
        transferAmount,
        deductions: 0,
        netTransfer: transferAmount,
        proceduresCount: data.count,
      };
    });

    return results;
  }

  async generateTransfers(clinicId: string, month: string) {
    // Check if transfers already exist for this month
    const existing = await this.transferRepo.find({
      where: { clinicId, referenceMonth: month },
    });
    if (existing.length > 0) {
      throw new ConflictException('Transfers already generated for this month');
    }

    const calculated = await this.calculateTransfers(clinicId, month);
    const transfers: FinancialDoctorTransfer[] = [];

    for (const calc of calculated) {
      const transfer = this.transferRepo.create({
        ...calc,
        clinicId,
        status: 'CALCULADO',
      });
      const saved = await this.transferRepo.save(transfer);
      transfers.push(saved);
    }

    return transfers;
  }

  async approveTransfer(clinicId: string, id: string) {
    const transfer = await this.transferRepo.findOne({ where: { id, clinicId } });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    transfer.status = 'APROVADO';
    return this.transferRepo.save(transfer);
  }

  async payTransfer(clinicId: string, id: string) {
    const transfer = await this.transferRepo.findOne({ where: { id, clinicId } });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    transfer.status = 'PAGO';
    transfer.paidAt = new Date();

    // Create cashflow SAIDA entry
    const entry = this.cashflowRepo.create({
      clinicId,
      type: 'SAIDA',
      sourceType: 'REPASSE',
      sourceId: transfer.id,
      description: `Repasse médico: ${transfer.referenceMonth}`,
      value: Number(transfer.netTransfer),
      date: new Date(),
      category: 'REPASSE_MEDICO',
    });
    await this.cashflowRepo.save(entry);

    return this.transferRepo.save(transfer);
  }

  async getMyTransfers(doctorId: string) {
    return this.transferRepo.find({
      where: { doctorId },
      order: { referenceMonth: 'DESC' },
    });
  }

  // ─── CASHFLOW ──────────────────────────────────────────────────────────────

  async listCashflow(
    clinicId: string,
    filters: { type?: string; startDate?: string; endDate?: string; page?: number; limit?: number },
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: FindOptionsWhere<FinancialCashflowEntry> = { clinicId };

    if (filters.type) where.type = filters.type;
    if (filters.startDate && filters.endDate) {
      where.date = Between(new Date(filters.startDate), new Date(filters.endDate)) as any;
    } else if (filters.startDate) {
      where.date = MoreThanOrEqual(new Date(filters.startDate)) as any;
    } else if (filters.endDate) {
      where.date = LessThanOrEqual(new Date(filters.endDate)) as any;
    }

    const [data, total] = await this.cashflowRepo.findAndCount({
      where,
      order: { date: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getBalance(clinicId: string) {
    const entries = await this.cashflowRepo.find({ where: { clinicId } });
    let balance = 0;
    let totalEntradas = 0;
    let totalSaidas = 0;

    for (const entry of entries) {
      const val = Number(entry.value) || 0;
      if (entry.type === 'ENTRADA') {
        totalEntradas += val;
        balance += val;
      } else {
        totalSaidas += val;
        balance -= val;
      }
    }

    return { balance, totalEntradas, totalSaidas };
  }

  async createAdjustment(clinicId: string, dto: any) {
    const entry = this.cashflowRepo.create({
      ...dto,
      clinicId,
      sourceType: 'AJUSTE',
      reconciled: false,
    });
    return this.cashflowRepo.save(entry);
  }

  async reconcileEntry(clinicId: string, id: string) {
    const entry = await this.cashflowRepo.findOne({ where: { id, clinicId } });
    if (!entry) {
      throw new NotFoundException('Cashflow entry not found');
    }
    entry.reconciled = true;
    return this.cashflowRepo.save(entry);
  }

  // ─── DRE ───────────────────────────────────────────────────────────────────

  async getDRE(clinicId: string, year: number, month: number) {
    const startDate = new Date(`${year}-${String(month).padStart(2, '0')}-01`);
    const endDate = new Date(`${year}-${String(month).padStart(2, '0')}-31`);

    // Revenues in the month
    const revenues = await this.revenueRepo.find({
      where: {
        clinicId,
        dueDate: Between(startDate, endDate) as any,
      },
    });

    // Receita Bruta
    const receitaBruta = revenues.reduce((sum, r) => sum + (Number(r.grossValue) || 0), 0);

    // Deductions
    const glosaTotal = revenues.reduce((sum, r) => sum + (Number(r.glosaValue) || 0), 0);
    const discountTotal = revenues.reduce((sum, r) => sum + (Number(r.discountValue) || 0), 0);
    const cancelledTotal = revenues
      .filter((r) => r.status === 'CANCELADO')
      .reduce((sum, r) => sum + (Number(r.grossValue) || 0), 0);
    const deductions = glosaTotal + discountTotal + cancelledTotal;

    // Receita Líquida
    const receitaLiquida = receitaBruta - deductions;

    // Custos Assistenciais (doctor transfers)
    const referenceMonth = `${year}-${String(month).padStart(2, '0')}`;
    const transfers = await this.transferRepo.find({
      where: { clinicId, referenceMonth },
    });
    const custosAssistenciais = transfers.reduce(
      (sum, t) => sum + (Number(t.netTransfer) || 0),
      0,
    );

    // Lucro Bruto
    const lucroBruto = receitaLiquida - custosAssistenciais;

    // Despesas Operacionais
    const expenses = await this.expenseRepo.find({
      where: {
        clinicId,
        dueDate: Between(startDate, endDate) as any,
      },
    });
    const despesasOperacionais = expenses.reduce(
      (sum, e) => sum + (Number(e.netValue) || 0),
      0,
    );

    // EBITDA
    const ebitda = lucroBruto - despesasOperacionais;

    // Impostos
    const settings = await this.getSettings(clinicId);
    const issRate = Number(settings.issRate) || 0;
    const dasRate = Number(settings.dasRate) || 0;
    const irpjRate = Number(settings.irpjRate) || 0;
    const csllRate = Number(settings.csllRate) || 0;
    const totalTaxRate = issRate + dasRate + irpjRate + csllRate;
    const impostos = (receitaLiquida * totalTaxRate) / 100;

    // Resultado Líquido
    const resultadoLiquido = ebitda - impostos;

    return {
      period: { year, month },
      receitaBruta,
      deductions: {
        glosas: glosaTotal,
        descontos: discountTotal,
        cancelamentos: cancelledTotal,
        total: deductions,
      },
      receitaLiquida,
      custosAssistenciais,
      lucroBruto,
      despesasOperacionais,
      ebitda,
      impostos: {
        iss: (receitaLiquida * issRate) / 100,
        das: (receitaLiquida * dasRate) / 100,
        irpj: (receitaLiquida * irpjRate) / 100,
        csll: (receitaLiquida * csllRate) / 100,
        total: impostos,
      },
      resultadoLiquido,
      margemLiquida: receitaLiquida > 0 ? (resultadoLiquido / receitaLiquida) * 100 : 0,
    };
  }

  // ─── DASHBOARD KPIs ────────────────────────────────────────────────────────

  async getDashboardKPIs(clinicId: string) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startDate = new Date(`${currentMonth}-01`);
    const endDate = new Date(`${currentMonth}-31`);

    // Current month revenues
    const revenues = await this.revenueRepo.find({
      where: { clinicId, dueDate: Between(startDate, endDate) as any },
    });

    const faturamento = revenues.reduce((sum, r) => sum + (Number(r.netValue) || 0), 0);
    const totalRevenues = revenues.length;
    const ticketMedio = totalRevenues > 0 ? faturamento / totalRevenues : 0;

    // Inadimplência
    const pendentes = revenues.filter((r) => r.status === 'PENDENTE');
    const valorPendente = pendentes.reduce((sum, r) => sum + (Number(r.netValue) || 0), 0);
    const inadimplencia = faturamento > 0 ? (valorPendente / faturamento) * 100 : 0;

    // Expenses this month
    const expenses = await this.expenseRepo.find({
      where: { clinicId, dueDate: Between(startDate, endDate) as any },
    });
    const totalDespesas = expenses.reduce((sum, e) => sum + (Number(e.netValue) || 0), 0);
    const lucro = faturamento - totalDespesas;

    // Growth (compare with previous month)
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevStartDate = new Date(`${prevYear}-${String(prevMonth).padStart(2, '0')}-01`);
    const prevEndDate = new Date(`${prevYear}-${String(prevMonth).padStart(2, '0')}-31`);

    const prevRevenues = await this.revenueRepo.find({
      where: { clinicId, dueDate: Between(prevStartDate, prevEndDate) as any },
    });
    const prevFaturamento = prevRevenues.reduce(
      (sum, r) => sum + (Number(r.netValue) || 0),
      0,
    );
    const crescimento =
      prevFaturamento > 0 ? ((faturamento - prevFaturamento) / prevFaturamento) * 100 : 0;

    return {
      faturamento,
      lucro,
      ticketMedio,
      inadimplencia: Math.round(inadimplencia * 100) / 100,
      crescimento: Math.round(crescimento * 100) / 100,
      totalRevenues,
      totalDespesas,
    };
  }

  async getRevenueBySpecialty(clinicId: string) {
    const revenues = await this.revenueRepo.find({ where: { clinicId } });
    const bySpecialty: Record<string, { total: number; count: number }> = {};

    for (const rev of revenues) {
      const specialty = rev.specialty || 'Outros';
      if (!bySpecialty[specialty]) {
        bySpecialty[specialty] = { total: 0, count: 0 };
      }
      bySpecialty[specialty].total += Number(rev.netValue) || 0;
      bySpecialty[specialty].count += 1;
    }

    return Object.entries(bySpecialty).map(([specialty, data]) => ({
      specialty,
      total: data.total,
      count: data.count,
    }));
  }

  async getRecentTransactions(clinicId: string, limit: number) {
    return this.revenueRepo.find({
      where: { clinicId },
      relations: ['convenio'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ─── REPORTS ───────────────────────────────────────────────────────────────

  async getRevenueReport(clinicId: string, filters: { startDate: string; endDate: string; doctorId?: string; convenioId?: string }) {
    const where: any = { clinicId };
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.convenioId) where.convenioId = filters.convenioId;
    where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));

    const revenues = await this.revenueRepo.find({ where, relations: ['convenio'], order: { dueDate: 'ASC' } });

    const byConvenio: Record<string, { name: string; total: number; count: number }> = {};
    const byDoctor: Record<string, { total: number; count: number }> = {};
    let totalGeral = 0;

    for (const rev of revenues) {
      const val = Number(rev.netValue) || 0;
      totalGeral += val;
      const convName = rev.convenio?.name || 'Particular';
      if (!byConvenio[convName]) byConvenio[convName] = { name: convName, total: 0, count: 0 };
      byConvenio[convName].total += val;
      byConvenio[convName].count += 1;

      const docId = rev.doctorId || 'unknown';
      if (!byDoctor[docId]) byDoctor[docId] = { total: 0, count: 0 };
      byDoctor[docId].total += val;
      byDoctor[docId].count += 1;
    }

    return { totalGeral, totalRegistros: revenues.length, byConvenio: Object.values(byConvenio), byDoctor: Object.values(byDoctor), details: revenues };
  }

  async getInadimplenciaReport(clinicId: string, filters: { startDate?: string; endDate?: string; minValue?: number }) {
    const where: any = { clinicId, status: 'VENCIDO' };
    if (filters.startDate && filters.endDate) {
      where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));
    }

    let revenues = await this.revenueRepo.find({ where, relations: ['convenio'], order: { dueDate: 'ASC' } });
    if (filters.minValue) {
      revenues = revenues.filter(r => Number(r.netValue) >= filters.minValue);
    }

    const totalInadimplente = revenues.reduce((sum, r) => sum + (Number(r.netValue) || 0), 0);
    return { totalInadimplente, totalRegistros: revenues.length, details: revenues };
  }

  async getGlosaReport(clinicId: string, filters: { startDate: string; endDate: string; convenioId?: string }) {
    const where: any = { clinicId, status: 'GLOSADO' };
    if (filters.convenioId) where.convenioId = filters.convenioId;
    where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));

    const revenues = await this.revenueRepo.find({ where, relations: ['convenio'], order: { dueDate: 'ASC' } });

    const byConvenio: Record<string, { name: string; totalGlosa: number; count: number }> = {};
    let totalGlosa = 0;

    for (const rev of revenues) {
      const val = Number(rev.glosaValue) || Number(rev.netValue) || 0;
      totalGlosa += val;
      const convName = rev.convenio?.name || 'Desconhecido';
      if (!byConvenio[convName]) byConvenio[convName] = { name: convName, totalGlosa: 0, count: 0 };
      byConvenio[convName].totalGlosa += val;
      byConvenio[convName].count += 1;
    }

    return { totalGlosa, totalRegistros: revenues.length, byConvenio: Object.values(byConvenio), details: revenues };
  }

  async getExpensesByCostCenterReport(clinicId: string, filters: { startDate: string; endDate: string; costCenterId?: string }) {
    const where: any = { clinicId };
    if (filters.costCenterId) where.costCenterId = filters.costCenterId;
    where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));

    const expenses = await this.expenseRepo.find({ where, relations: ['costCenter'], order: { dueDate: 'ASC' } });

    const byCostCenter: Record<string, { name: string; total: number; count: number }> = {};
    let totalGeral = 0;

    for (const exp of expenses) {
      const val = Number(exp.netValue) || 0;
      totalGeral += val;
      const ccName = exp.costCenter?.name || 'Sem centro';
      if (!byCostCenter[ccName]) byCostCenter[ccName] = { name: ccName, total: 0, count: 0 };
      byCostCenter[ccName].total += val;
      byCostCenter[ccName].count += 1;
    }

    return { totalGeral, totalRegistros: expenses.length, byCostCenter: Object.values(byCostCenter), details: expenses };
  }

  async getProductivityReport(clinicId: string, filters: { startDate: string; endDate: string }) {
    const where: any = { clinicId, status: 'PAGO' };
    where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));

    const revenues = await this.revenueRepo.find({ where, order: { dueDate: 'ASC' } });

    const byDoctor: Record<string, { doctorId: string; total: number; count: number; ticketMedio: number }> = {};

    for (const rev of revenues) {
      const docId = rev.doctorId || 'unknown';
      const val = Number(rev.netValue) || 0;
      if (!byDoctor[docId]) byDoctor[docId] = { doctorId: docId, total: 0, count: 0, ticketMedio: 0 };
      byDoctor[docId].total += val;
      byDoctor[docId].count += 1;
    }

    const ranking = Object.values(byDoctor)
      .map(d => ({ ...d, ticketMedio: d.count > 0 ? d.total / d.count : 0 }))
      .sort((a, b) => b.total - a.total);

    return { ranking, totalMedicos: ranking.length };
  }

  // ─── OVERDUE JOB ───────────────────────────────────────────────────────────

  async markOverdueItems() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Mark overdue revenues
    const overdueRevenues = await this.revenueRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: 'PENDENTE' })
      .andWhere('r.dueDate < :today', { today })
      .getMany();

    for (const rev of overdueRevenues) {
      rev.status = 'VENCIDO';
      await this.revenueRepo.save(rev);
    }

    // Mark overdue expenses
    const overdueExpenses = await this.expenseRepo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: 'PENDENTE' })
      .andWhere('e.dueDate < :today', { today })
      .getMany();

    for (const exp of overdueExpenses) {
      exp.status = 'VENCIDO';
      await this.expenseRepo.save(exp);
    }

    return { overdueRevenues: overdueRevenues.length, overdueExpenses: overdueExpenses.length };
  }
}
