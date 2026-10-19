import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  FindOptionsWhere,
  Like,
  In,
} from 'typeorm';
import { FinancialSettings } from '../entities/financial-settings.entity';
import { FinancialCostCenter } from '../entities/financial-cost-center.entity';
import { FinancialConvenio } from '../entities/financial-convenio.entity';
import { FinancialConvenioProcedure } from '../entities/financial-convenio-procedure.entity';
import { FinancialConvenioPlan } from '../entities/financial-convenio-plan.entity';
import { FinancialRevenue } from '../entities/financial-revenue.entity';
import { FinancialExpense } from '../entities/financial-expense.entity';
import { FinancialDoctorTransfer } from '../entities/financial-doctor-transfer.entity';
import { FinancialCashflowEntry } from '../entities/financial-cashflow-entry.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import {
  UpdateFinancialSettingsDto,
  CreateCostCenterDto,
  UpdateCostCenterDto,
  CreateConvenioDto,
  UpdateConvenioDto,
  CreateConvenioProcedureDto,
  UpdateConvenioProcedureDto,
  CreateConvenioPlanDto,
  UpdateConvenioPlanDto,
  CreateRevenueDto,
  UpdateRevenueDto,
  CreateExpenseDto,
  UpdateExpenseDto,
  CreateCashflowAdjustmentDto,
} from './dto';

/**
 * Copies only the given keys from a DTO onto an entity, and only when the
 * key was actually present in the payload.
 *
 * Replaces `Object.assign(entity, dto)` throughout this service. The DTOs +
 * global ValidationPipe already strip unknown properties, so this is defence
 * in depth rather than the primary control: it means a field can only ever
 * be written if it appears in an explicit allow-list *here too*, so adding a
 * column to an entity (or a property to a DTO) can't silently become
 * client-writable. `clinicId`/`id` are absent from every list below.
 *
 * `undefined` is skipped so a partial update doesn't blank out fields the
 * client didn't mention, while an explicit `null` still clears a nullable
 * column.
 */
function applyAllowedFields<T extends object, D extends object>(
  entity: T,
  dto: D,
  // Each key must exist on BOTH the entity and the DTO, so a typo or a field
  // renamed on only one side is a compile error rather than a silently
  // ignored update.
  allowed: ReadonlyArray<keyof T & keyof D & string>,
): void {
  const source = dto as Record<string, unknown>;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      (entity as Record<string, unknown>)[key] = source[key];
    }
  }
}
import { TussProcedure } from '../entities/tuss-procedure.entity';

@Injectable()
export class FinancialService {
  constructor(
    @InjectRepository(FinancialSettings)
    private readonly settingsRepo: Repository<FinancialSettings>,
    @InjectRepository(FinancialCostCenter)
    private readonly costCenterRepo: Repository<FinancialCostCenter>,
    @InjectRepository(FinancialConvenio)
    private readonly convenioRepo: Repository<FinancialConvenio>,
    @InjectRepository(FinancialConvenioProcedure)
    private readonly convenioProcedureRepo: Repository<FinancialConvenioProcedure>,
    @InjectRepository(FinancialConvenioPlan)
    private readonly convenioPlanRepo: Repository<FinancialConvenioPlan>,
    @InjectRepository(FinancialRevenue)
    private readonly revenueRepo: Repository<FinancialRevenue>,
    @InjectRepository(FinancialExpense)
    private readonly expenseRepo: Repository<FinancialExpense>,
    @InjectRepository(FinancialDoctorTransfer)
    private readonly transferRepo: Repository<FinancialDoctorTransfer>,
    @InjectRepository(FinancialCashflowEntry)
    private readonly cashflowRepo: Repository<FinancialCashflowEntry>,
    @InjectRepository(ClinicMembership)
    private readonly clinicMembershipRepo: Repository<ClinicMembership>,
    @InjectRepository(TussProcedure)
    private readonly tussProcedureRepo: Repository<TussProcedure>,
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

  /** Fields an admin may change on their clinic's financial settings.
   * `clinicId`/`id` excluded on purpose — see applyAllowedFields. */
  private static readonly SETTINGS_FIELDS = [
    'taxRegime',
    'issRate',
    'dasRate',
    'irpjRate',
    'csllRate',
    'defaultDoctorTransferPercentage',
    'bankName',
    'bankAgency',
    'bankAccount',
    'pixKey',
    'invoicePrefix',
  ] as const;

  async updateSettings(clinicId: string, dto: UpdateFinancialSettingsDto) {
    const settings = await this.getSettings(clinicId);
    applyAllowedFields(settings, dto, FinancialService.SETTINGS_FIELDS);
    // Re-pinned rather than trusted from the payload: getSettings already
    // scoped the row to this clinic, and clinicId is not an updatable field.
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

  private static readonly COST_CENTER_FIELDS = [
    'name',
    'code',
    'budgetAllocated',
    'color',
    'description',
  ] as const;

  /** `active` is only settable on update (DELETE soft-deletes by clearing
   * it); a new cost center always starts active via the column default. */
  private static readonly COST_CENTER_UPDATE_FIELDS = [
    ...FinancialService.COST_CENTER_FIELDS,
    'active',
  ] as const;

  async createCostCenter(clinicId: string, dto: CreateCostCenterDto) {
    const existing = await this.costCenterRepo.findOne({
      where: { clinicId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException('Cost center code already exists');
    }
    // Built field-by-field instead of `create({ ...dto, clinicId })`: the
    // spread form relied entirely on the DTO to keep clinicId/id out of the
    // payload, with nothing behind it if that ever regressed.
    const costCenter = this.costCenterRepo.create({ clinicId });
    applyAllowedFields(costCenter, dto, FinancialService.COST_CENTER_FIELDS);
    return this.costCenterRepo.save(costCenter);
  }

  async updateCostCenter(clinicId: string, id: string, dto: UpdateCostCenterDto) {
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
    applyAllowedFields(costCenter, dto, FinancialService.COST_CENTER_UPDATE_FIELDS);
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

  /** Cross-clinic search by name — used by the patient app, which has no
   * active clinic of its own to scope by. */
  async searchConvenios(q: string) {
    if (!q || q.trim().length < 3) {
      return [];
    }

    return this.convenioRepo.find({
      where: { name: Like(`%${q.trim()}%`), active: true },
      order: { name: 'ASC' },
      take: 30,
    });
  }

  private static readonly CONVENIO_FIELDS = [
    'name',
    'ansCode',
    'cnpj',
    'contractTable',
    'paymentTerm',
    'glosaTolerance',
    'markupPercentage',
    'contactName',
    'contactPhone',
    'contactEmail',
    'contractStartDate',
    'contractEndDate',
    'notes',
  ] as const;

  /** `active` is update-only here too — PATCH /convenios/:id/toggle is the
   * usual path, and creation defaults to active. */
  private static readonly CONVENIO_UPDATE_FIELDS = [
    ...FinancialService.CONVENIO_FIELDS,
    'active',
  ] as const;

  async createConvenio(clinicId: string, dto: CreateConvenioDto) {
    const existing = await this.convenioRepo.findOne({
      where: { clinicId, ansCode: dto.ansCode },
    });
    if (existing) {
      throw new ConflictException('ANS code already exists for this clinic');
    }
    const convenio = this.convenioRepo.create({ clinicId });
    applyAllowedFields(convenio, dto, FinancialService.CONVENIO_FIELDS);
    return this.convenioRepo.save(convenio);
  }

  async updateConvenio(clinicId: string, id: string, dto: UpdateConvenioDto) {
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
    applyAllowedFields(convenio, dto, FinancialService.CONVENIO_UPDATE_FIELDS);
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

  // ─── CONVENIO PROCEDURES (remuneration table per convênio) ─────────────────

  async listConvenioProcedures(clinicId: string, convenioId: string) {
    const convenio = await this.convenioRepo.findOne({ where: { id: convenioId, clinicId } });
    if (!convenio) {
      throw new NotFoundException('Convenio not found');
    }
    return this.convenioProcedureRepo.find({
      where: { clinicId, convenioId },
      order: { procedureName: 'ASC' },
    });
  }

  private static readonly CONVENIO_PROCEDURE_FIELDS = [
    'procedureCode',
    'procedureName',
    'value',
    'active',
  ] as const;

  async createConvenioProcedure(
    clinicId: string,
    convenioId: string,
    dto: CreateConvenioProcedureDto,
  ) {
    const convenio = await this.convenioRepo.findOne({ where: { id: convenioId, clinicId } });
    if (!convenio) {
      throw new NotFoundException('Convenio not found');
    }
    const existing = await this.convenioProcedureRepo.findOne({
      where: { convenioId, procedureCode: dto.procedureCode },
    });
    if (existing) {
      throw new ConflictException('Procedure code already registered for this convenio');
    }
    // clinicId/convenioId come from the validated path and auth context, not
    // the body: otherwise the two could disagree and a row would be filed
    // under a convênio the URL never addressed (and never checked).
    const procedure = this.convenioProcedureRepo.create({ clinicId, convenioId });
    applyAllowedFields(procedure, dto, FinancialService.CONVENIO_PROCEDURE_FIELDS);
    return this.convenioProcedureRepo.save(procedure);
  }

  async updateConvenioProcedure(
    clinicId: string,
    convenioId: string,
    id: string,
    dto: UpdateConvenioProcedureDto,
  ) {
    const procedure = await this.convenioProcedureRepo.findOne({
      where: { id, clinicId, convenioId },
    });
    if (!procedure) {
      throw new NotFoundException('Convenio procedure not found');
    }
    applyAllowedFields(procedure, dto, FinancialService.CONVENIO_PROCEDURE_FIELDS);
    return this.convenioProcedureRepo.save(procedure);
  }

  async deleteConvenioProcedure(clinicId: string, convenioId: string, id: string) {
    const procedure = await this.convenioProcedureRepo.findOne({
      where: { id, clinicId, convenioId },
    });
    if (!procedure) {
      throw new NotFoundException('Convenio procedure not found');
    }
    await this.convenioProcedureRepo.remove(procedure);
  }

  // ─── CONVENIO PLANS (per-convênio insurance plans) ─────────────────────────

  async listConvenioPlans(clinicId: string, convenioId: string) {
    const convenio = await this.convenioRepo.findOne({ where: { id: convenioId, clinicId } });
    if (!convenio) {
      throw new NotFoundException('Convenio not found');
    }
    return this.convenioPlanRepo.find({
      where: { clinicId, convenioId },
      order: { name: 'ASC' },
    });
  }

  private static readonly CONVENIO_PLAN_FIELDS = ['name', 'active'] as const;

  async createConvenioPlan(clinicId: string, convenioId: string, dto: CreateConvenioPlanDto) {
    const convenio = await this.convenioRepo.findOne({ where: { id: convenioId, clinicId } });
    if (!convenio) {
      throw new NotFoundException('Convenio not found');
    }
    const existing = await this.convenioPlanRepo.findOne({
      where: { convenioId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Plan already registered for this convenio');
    }
    const plan = this.convenioPlanRepo.create({ clinicId, convenioId });
    applyAllowedFields(plan, dto, FinancialService.CONVENIO_PLAN_FIELDS);
    return this.convenioPlanRepo.save(plan);
  }

  async updateConvenioPlan(
    clinicId: string,
    convenioId: string,
    id: string,
    dto: UpdateConvenioPlanDto,
  ) {
    const plan = await this.convenioPlanRepo.findOne({
      where: { id, clinicId, convenioId },
    });
    if (!plan) {
      throw new NotFoundException('Convenio plan not found');
    }
    applyAllowedFields(plan, dto, FinancialService.CONVENIO_PLAN_FIELDS);
    return this.convenioPlanRepo.save(plan);
  }

  async deleteConvenioPlan(clinicId: string, convenioId: string, id: string) {
    const plan = await this.convenioPlanRepo.findOne({
      where: { id, clinicId, convenioId },
    });
    if (!plan) {
      throw new NotFoundException('Convenio plan not found');
    }
    await this.convenioPlanRepo.remove(plan);
  }

  // ─── TUSS PROCEDURES (official ANS code lookup for autocomplete) ───────────

  async searchTussProcedures(query: string) {
    const term = (query || '').trim();
    if (term.length < 3) {
      return [];
    }
    const qb = this.tussProcedureRepo
      .createQueryBuilder('t')
      .where('(t.validUntil IS NULL OR t.validUntil >= CURDATE())')
      .andWhere('(t.code LIKE :prefix OR t.name LIKE :contains)', {
        prefix: `${term}%`,
        contains: `%${term}%`,
      })
      .orderBy('CASE WHEN t.code LIKE :prefix THEN 0 ELSE 1 END', 'ASC')
      .addOrderBy('t.name', 'ASC')
      .take(20);
    return qb.getMany();
  }

  /**
   * The N TUSS codes this clinic has actually billed most often, shown as a
   * head-start when the procedure field is focused empty — picked from this
   * clinic's own revenue history rather than a generic/global list.
   */
  async getCommonTussProcedures(clinicId: string, limit = 5): Promise<TussProcedure[]> {
    const ranked = await this.revenueRepo
      .createQueryBuilder('r')
      .select('r.procedureCode', 'code')
      .addSelect('COUNT(*)', 'useCount')
      .where('r.clinicId = :clinicId', { clinicId })
      .andWhere('r.procedureCode IS NOT NULL')
      .groupBy('r.procedureCode')
      .orderBy('useCount', 'DESC')
      .limit(limit)
      .getRawMany<{ code: string; useCount: string }>();

    const codes = ranked.map((r) => r.code);
    if (!codes.length) {
      return [];
    }
    const procedures = await this.tussProcedureRepo.find({ where: { code: In(codes) } });
    const byCode = new Map(procedures.map((p) => [p.code, p]));
    return codes.map((code) => byCode.get(code)).filter((p): p is TussProcedure => !!p);
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
      minValue?: number;
      maxValue?: number;
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
    if (filters.minValue !== undefined && filters.maxValue !== undefined) {
      where.netValue = Between(filters.minValue, filters.maxValue) as any;
    } else if (filters.minValue !== undefined) {
      where.netValue = MoreThanOrEqual(filters.minValue) as any;
    } else if (filters.maxValue !== undefined) {
      where.netValue = LessThanOrEqual(filters.maxValue) as any;
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

  // A revenue/expense created directly with status PAGO (the quick-create
  // forms allow picking this up front, not just via a later "Receber"/"Pagar"
  // action) must leave the cash flow just as consistent as if it had gone
  // through updateRevenueStatus()/payExpense() — otherwise a retroactively
  // logged, already-settled entry silently never shows up as cash in/out.
  private async createRevenueCashflowEntry(clinicId: string, revenue: FinancialRevenue) {
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

  private async createExpenseCashflowEntry(clinicId: string, expense: FinancialExpense) {
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
  }

  /**
   * Client-writable fields on a revenue.
   *
   * Excluded on purpose: `clinicId`/`id` (tenant + identity), `netValue`
   * (always derived from grossValue - discountValue below), `paidAt`
   * (server-stamped, so a paid date can't be moved outside a DRE window),
   * and `glosaValue`/`glosaReason` (only via updateRevenueStatus, the path
   * that also keeps the cash flow consistent).
   */
  private static readonly REVENUE_FIELDS = [
    'patientId',
    'doctorId',
    'appointmentId',
    'convenioId',
    'procedure',
    'procedureCode',
    'specialty',
    'grossValue',
    'discountValue',
    'paymentMethod',
    'status',
    'dueDate',
    'invoiceNumber',
    'guideNumber',
    'authorizationNumber',
    'insurancePlanName',
    'insuranceCardNumber',
    'notes',
  ] as const;

  async createRevenue(clinicId: string, dto: CreateRevenueDto) {
    const revenue = this.revenueRepo.create({ clinicId });
    applyAllowedFields(revenue, dto, FinancialService.REVENUE_FIELDS);

    // Recomputed server-side, never taken from the payload: the client does
    // send netValue today, and trusting it would let a receivable be booked
    // with a total unrelated to its gross/discount.
    const grossValue = Number(dto.grossValue) || 0;
    const discountValue = Number(dto.discountValue) || 0;
    revenue.grossValue = grossValue;
    revenue.discountValue = discountValue;
    revenue.netValue = grossValue - discountValue;
    revenue.status = dto.status || 'PENDENTE';

    if (revenue.status === 'PAGO') {
      revenue.paidAt = new Date();
    }
    const saved = await this.revenueRepo.save(revenue);
    if (saved.status === 'PAGO') {
      await this.createRevenueCashflowEntry(clinicId, saved);
    }
    return saved;
  }

  async updateRevenue(clinicId: string, id: string, dto: UpdateRevenueDto) {
    const revenue = await this.revenueRepo.findOne({ where: { id, clinicId } });
    if (!revenue) {
      throw new NotFoundException('Revenue not found');
    }
    applyAllowedFields(revenue, dto, FinancialService.REVENUE_FIELDS);
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
      await this.createRevenueCashflowEntry(clinicId, revenue);
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
      minValue?: number;
      maxValue?: number;
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
    if (filters.minValue !== undefined && filters.maxValue !== undefined) {
      where.netValue = Between(filters.minValue, filters.maxValue) as any;
    } else if (filters.minValue !== undefined) {
      where.netValue = MoreThanOrEqual(filters.minValue) as any;
    } else if (filters.maxValue !== undefined) {
      where.netValue = LessThanOrEqual(filters.maxValue) as any;
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

  /** Client-writable fields on an expense. `clinicId`/`id`, `netValue`
   * (derived) and `paidAt` (server-stamped) are excluded. */
  private static readonly EXPENSE_FIELDS = [
    'costCenterId',
    'category',
    'subcategory',
    'provider',
    'providerCnpj',
    'description',
    'grossValue',
    'taxValue',
    'paymentMethod',
    'status',
    'dueDate',
    'recurrence',
    'invoiceNumber',
    'attachmentUrl',
    'notes',
  ] as const;

  async createExpense(clinicId: string, dto: CreateExpenseDto) {
    const expense = this.expenseRepo.create({ clinicId });
    applyAllowedFields(expense, dto, FinancialService.EXPENSE_FIELDS);

    // Same reasoning as createRevenue: netValue is derived, never trusted.
    const grossValue = Number(dto.grossValue) || 0;
    const taxValue = Number(dto.taxValue) || 0;
    expense.grossValue = grossValue;
    expense.taxValue = taxValue;
    expense.netValue = grossValue + taxValue;
    expense.status = dto.status || 'PENDENTE';

    if (expense.status === 'PAGO') {
      expense.paidAt = new Date();
    }
    const saved = await this.expenseRepo.save(expense);
    if (saved.status === 'PAGO') {
      await this.createExpenseCashflowEntry(clinicId, saved);
    }
    return saved;
  }

  async updateExpense(clinicId: string, id: string, dto: UpdateExpenseDto) {
    const expense = await this.expenseRepo.findOne({ where: { id, clinicId } });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    applyAllowedFields(expense, dto, FinancialService.EXPENSE_FIELDS);
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
    await this.createExpenseCashflowEntry(clinicId, expense);

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

    const defaultPercentage = Number(settings.defaultDoctorTransferPercentage) || 50;

    const doctorIds = Object.keys(doctorMap);
    const memberships = doctorIds.length
      ? await this.clinicMembershipRepo.find({
          where: { clinicId, professionalId: In(doctorIds) },
          select: ['professionalId', 'transferPercentage'],
        })
      : [];
    const overrideByDoctorId = new Map(
      memberships
        .filter((m) => m.transferPercentage !== null && m.transferPercentage !== undefined)
        .map((m) => [m.professionalId, Number(m.transferPercentage)]),
    );

    const results = Object.entries(doctorMap).map(([doctorId, data]) => {
      const percentage = overrideByDoctorId.get(doctorId) ?? defaultPercentage;
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

  /** Client-writable fields on a manual cash-flow adjustment. Notably absent:
   * `sourceType`/`sourceId` (forced below, so an adjustment can't pose as a
   * system-generated entry), `reconciled` (would skip review) and
   * `balanceAfter` (derived snapshot). */
  private static readonly CASHFLOW_ADJUSTMENT_FIELDS = [
    'type',
    'description',
    'value',
    'date',
    'category',
  ] as const;

  async createAdjustment(clinicId: string, dto: CreateCashflowAdjustmentDto) {
    const entry = this.cashflowRepo.create({ clinicId });
    applyAllowedFields(entry, dto, FinancialService.CASHFLOW_ADJUSTMENT_FIELDS);
    // Pinned after the copy so the payload can never override them.
    entry.sourceType = 'AJUSTE';
    entry.sourceId = null;
    entry.reconciled = false;
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
    const custosAssistenciais = transfers.reduce((sum, t) => sum + (Number(t.netTransfer) || 0), 0);

    // Lucro Bruto
    const lucroBruto = receitaLiquida - custosAssistenciais;

    // Despesas Operacionais
    const expenses = await this.expenseRepo.find({
      where: {
        clinicId,
        dueDate: Between(startDate, endDate) as any,
      },
    });
    const despesasOperacionais = expenses.reduce((sum, e) => sum + (Number(e.netValue) || 0), 0);

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

  async getDashboardKPIs(clinicId: string, year?: number, month?: number) {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || now.getMonth() + 1;
    const currentMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const startDate = new Date(`${currentMonth}-01`);
    const endDate = new Date(`${currentMonth}-31`);

    // Current month revenues
    const revenues = await this.revenueRepo.find({
      where: { clinicId, dueDate: Between(startDate, endDate) as any },
    });

    const faturamento = revenues.reduce((sum, r) => sum + (Number(r.netValue) || 0), 0);
    const totalRevenues = revenues.length;
    const ticketMedio = totalRevenues > 0 ? faturamento / totalRevenues : 0;

    // Inadimplência: only revenues actually past their dueDate (status
    // VENCIDO, flipped daily by the overdue cron) count as delinquent — a
    // PENDENTE revenue due later this month, or due today, isn't overdue yet.
    const vencidas = revenues.filter((r) => r.status === 'VENCIDO');
    const valorVencido = vencidas.reduce((sum, r) => sum + (Number(r.netValue) || 0), 0);
    const inadimplencia = faturamento > 0 ? (valorVencido / faturamento) * 100 : 0;

    // Expenses this month
    const expenses = await this.expenseRepo.find({
      where: { clinicId, dueDate: Between(startDate, endDate) as any },
    });
    const totalDespesas = expenses.reduce((sum, e) => sum + (Number(e.netValue) || 0), 0);
    const lucro = faturamento - totalDespesas;

    // Growth (compare with previous month, relative to the selected period)
    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    const prevStartDate = new Date(`${prevYear}-${String(prevMonth).padStart(2, '0')}-01`);
    const prevEndDate = new Date(`${prevYear}-${String(prevMonth).padStart(2, '0')}-31`);

    const prevRevenues = await this.revenueRepo.find({
      where: { clinicId, dueDate: Between(prevStartDate, prevEndDate) as any },
    });
    const prevFaturamento = prevRevenues.reduce((sum, r) => sum + (Number(r.netValue) || 0), 0);
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

  async getRevenueBySpecialty(clinicId: string, year?: number, month?: number) {
    const where: FindOptionsWhere<FinancialRevenue> = { clinicId };
    if (year && month) {
      const period = `${year}-${String(month).padStart(2, '0')}`;
      where.dueDate = Between(new Date(`${period}-01`), new Date(`${period}-31`)) as any;
    }
    const revenues = await this.revenueRepo.find({ where });
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

  async getRecentTransactions(clinicId: string, limit: number, status?: string) {
    const where: FindOptionsWhere<FinancialRevenue> = { clinicId };
    if (status) where.status = status;
    return this.revenueRepo.find({
      where,
      relations: ['convenio'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ─── REPORTS ───────────────────────────────────────────────────────────────

  async getRevenueReport(
    clinicId: string,
    filters: { startDate: string; endDate: string; doctorId?: string; convenioId?: string },
  ) {
    const where: any = { clinicId };
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.convenioId) where.convenioId = filters.convenioId;
    where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));

    const revenues = await this.revenueRepo.find({
      where,
      relations: ['convenio'],
      order: { dueDate: 'ASC' },
    });

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

    return {
      totalGeral,
      totalRegistros: revenues.length,
      byConvenio: Object.values(byConvenio),
      byDoctor: Object.values(byDoctor),
      details: revenues,
    };
  }

  async getInadimplenciaReport(
    clinicId: string,
    filters: { startDate?: string; endDate?: string; minValue?: number },
  ) {
    const where: any = { clinicId, status: 'VENCIDO' };
    if (filters.startDate && filters.endDate) {
      where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));
    }

    let revenues = await this.revenueRepo.find({
      where,
      relations: ['convenio'],
      order: { dueDate: 'ASC' },
    });
    if (filters.minValue) {
      revenues = revenues.filter((r) => Number(r.netValue) >= filters.minValue);
    }

    const totalInadimplente = revenues.reduce((sum, r) => sum + (Number(r.netValue) || 0), 0);
    return { totalInadimplente, totalRegistros: revenues.length, details: revenues };
  }

  async getGlosaReport(
    clinicId: string,
    filters: { startDate: string; endDate: string; convenioId?: string },
  ) {
    const where: any = { clinicId, status: 'GLOSADO' };
    if (filters.convenioId) where.convenioId = filters.convenioId;
    where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));

    const revenues = await this.revenueRepo.find({
      where,
      relations: ['convenio'],
      order: { dueDate: 'ASC' },
    });

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

    return {
      totalGlosa,
      totalRegistros: revenues.length,
      byConvenio: Object.values(byConvenio),
      details: revenues,
    };
  }

  async getExpensesByCostCenterReport(
    clinicId: string,
    filters: { startDate: string; endDate: string; costCenterId?: string },
  ) {
    const where: any = { clinicId };
    if (filters.costCenterId) where.costCenterId = filters.costCenterId;
    where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));

    const expenses = await this.expenseRepo.find({
      where,
      relations: ['costCenter'],
      order: { dueDate: 'ASC' },
    });

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

    return {
      totalGeral,
      totalRegistros: expenses.length,
      byCostCenter: Object.values(byCostCenter),
      details: expenses,
    };
  }

  async getProductivityReport(clinicId: string, filters: { startDate: string; endDate: string }) {
    const where: any = { clinicId, status: 'PAGO' };
    where.dueDate = Between(new Date(filters.startDate), new Date(filters.endDate));

    const revenues = await this.revenueRepo.find({ where, order: { dueDate: 'ASC' } });

    const byDoctor: Record<
      string,
      { doctorId: string; total: number; count: number; ticketMedio: number }
    > = {};

    for (const rev of revenues) {
      const docId = rev.doctorId || 'unknown';
      const val = Number(rev.netValue) || 0;
      if (!byDoctor[docId])
        byDoctor[docId] = { doctorId: docId, total: 0, count: 0, ticketMedio: 0 };
      byDoctor[docId].total += val;
      byDoctor[docId].count += 1;
    }

    const ranking = Object.values(byDoctor)
      .map((d) => ({ ...d, ticketMedio: d.count > 0 ? d.total / d.count : 0 }))
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
