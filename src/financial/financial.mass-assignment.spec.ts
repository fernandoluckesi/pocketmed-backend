import { ValidationPipe, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FinancialService } from './financial.service';
import {
  CreateRevenueDto,
  UpdateRevenueDto,
  CreateExpenseDto,
  UpdateExpenseDto,
  UpdateFinancialSettingsDto,
  CreateCostCenterDto,
  CreateConvenioDto,
  CreateCashflowAdjustmentDto,
  GenerateTransfersDto,
  UpdateRevenueStatusDto,
} from './dto';

/**
 * Covers security item #8 (mass assignment in the financial module).
 *
 * Two independent layers are asserted, because either one alone would leave
 * a gap:
 *  1. the DTOs + global ValidationPipe reject unknown/injected properties at
 *     the HTTP boundary (the pipe is configured in main.ts with
 *     `whitelist: true` + `forbidNonWhitelisted: true`, mirrored here);
 *  2. the service copies only explicitly allow-listed fields, so even a
 *     payload that somehow bypassed validation can't write `clinicId`, `id`,
 *     or a derived total.
 *
 * The scenarios map directly to the attack described in the audit: an
 * authenticated admin of clinic A sending `clinicId` or `id` in the body to
 * move/overwrite another clinic's financial records.
 */

/** Same configuration as `app.useGlobalPipes(...)` in main.ts. */
const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

function meta(metatype: any): ArgumentMetadata {
  return { type: 'body', metatype, data: undefined };
}

/** Minimal in-memory repository stub: enough for the write paths under test. */
function repoStub<T extends object>(seed: T[] = []): jest.Mocked<Repository<T>> {
  const rows = [...seed];
  return {
    // `create` mirrors TypeORM: merges the given partial into a new object.
    create: jest.fn((input: any = {}) => ({ ...input })),
    save: jest.fn(async (entity: any) => entity),
    findOne: jest.fn(async ({ where }: any) => {
      const conds = Array.isArray(where) ? where : [where];
      return (
        rows.find((r: any) => conds.some((c) => Object.entries(c).every(([k, v]) => r[k] === v))) ||
        null
      );
    }),
    find: jest.fn(async () => rows),
    findAndCount: jest.fn(async () => [rows, rows.length]),
    count: jest.fn(async () => 0),
    remove: jest.fn(async (e: any) => e),
    createQueryBuilder: jest.fn(),
  } as unknown as jest.Mocked<Repository<T>>;
}

const CLINIC_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLINIC_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RECORD_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_RECORD_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('Financial module — mass assignment protection (security item #8)', () => {
  describe('Layer 1: DTO validation rejects injected fields', () => {
    const tenantInjectionCases: Array<{ name: string; dto: any; payload: object }> = [
      {
        name: 'CreateRevenueDto',
        dto: CreateRevenueDto,
        payload: {
          procedure: 'Consulta',
          specialty: 'Cardiologia',
          grossValue: 100,
          paymentMethod: 'Convênio',
          dueDate: '2026-11-15',
          clinicId: CLINIC_B,
        },
      },
      {
        name: 'UpdateRevenueDto',
        dto: UpdateRevenueDto,
        payload: { clinicId: CLINIC_B },
      },
      {
        name: 'CreateExpenseDto',
        dto: CreateExpenseDto,
        payload: {
          category: 'Aluguel',
          provider: 'X',
          grossValue: 100,
          paymentMethod: 'Transferência',
          dueDate: '2026-11-10',
          clinicId: CLINIC_B,
        },
      },
      {
        name: 'UpdateExpenseDto',
        dto: UpdateExpenseDto,
        payload: { clinicId: CLINIC_B },
      },
      {
        name: 'UpdateFinancialSettingsDto',
        dto: UpdateFinancialSettingsDto,
        payload: { clinicId: CLINIC_B },
      },
      {
        name: 'CreateCostCenterDto',
        dto: CreateCostCenterDto,
        payload: { name: 'Infra', code: 'INFRA', clinicId: CLINIC_B },
      },
      {
        name: 'CreateConvenioDto',
        dto: CreateConvenioDto,
        payload: {
          name: 'Unimed',
          ansCode: '326305',
          contractTable: 'CBHPM',
          paymentTerm: 30,
          glosaTolerance: 5,
          clinicId: CLINIC_B,
        },
      },
      {
        name: 'CreateCashflowAdjustmentDto',
        dto: CreateCashflowAdjustmentDto,
        payload: {
          type: 'ENTRADA',
          description: 'Ajuste',
          value: 10,
          date: '2026-10-19',
          clinicId: CLINIC_B,
        },
      },
    ];

    it.each(tenantInjectionCases)(
      '$name rejects an injected clinicId (cross-tenant write)',
      async ({ dto, payload }) => {
        await expect(validationPipe.transform(payload, meta(dto))).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it('UpdateRevenueDto rejects an injected id (overwriting another record)', async () => {
      await expect(
        validationPipe.transform({ id: OTHER_RECORD_ID }, meta(UpdateRevenueDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('UpdateRevenueDto rejects server-owned paidAt and glosa fields', async () => {
      // paidAt: backdating a payment would move it out of a DRE window.
      await expect(
        validationPipe.transform({ paidAt: '2020-01-01' }, meta(UpdateRevenueDto)),
      ).rejects.toThrow(BadRequestException);
      // glosaValue belongs to PATCH /revenues/:id/status only.
      await expect(
        validationPipe.transform({ glosaValue: 50 }, meta(UpdateRevenueDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('CreateCashflowAdjustmentDto rejects sourceType/sourceId/reconciled', async () => {
      const base = {
        type: 'ENTRADA',
        description: 'Ajuste',
        value: 10,
        date: '2026-10-19',
      };
      // Forging sourceType would make a manual entry look system-generated.
      await expect(
        validationPipe.transform(
          { ...base, sourceType: 'RECEITA' },
          meta(CreateCashflowAdjustmentDto),
        ),
      ).rejects.toThrow(BadRequestException);
      // Self-reconciling would skip the review the flag exists for.
      await expect(
        validationPipe.transform({ ...base, reconciled: true }, meta(CreateCashflowAdjustmentDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid payload unchanged (no false positives)', async () => {
      const valid = {
        procedure: 'Consulta cardiológica',
        specialty: 'Cardiologia',
        grossValue: 350,
        discountValue: 0,
        paymentMethod: 'Convênio',
        dueDate: '2026-11-15',
        status: 'PENDENTE',
      };
      const result = await validationPipe.transform(valid, meta(CreateRevenueDto));
      expect(result).toMatchObject(valid);
    });

    it('still accepts the netValue the existing web client sends', async () => {
      // Regression guard: the web app posts netValue (see
      // web/src/services/financial.ts). Under forbidNonWhitelisted this
      // would 400 if the field were simply omitted from the DTO, breaking
      // the Receitas/Despesas screens.
      await expect(
        validationPipe.transform(
          {
            procedure: 'Consulta',
            specialty: 'Cardiologia',
            grossValue: 350,
            discountValue: 0,
            netValue: 350,
            paymentMethod: 'Convênio',
            dueDate: '2026-11-15',
            status: 'PENDENTE',
          },
          meta(CreateRevenueDto),
        ),
      ).resolves.toBeDefined();

      await expect(
        validationPipe.transform(
          {
            category: 'Aluguel',
            provider: 'Imobiliária',
            grossValue: 4500,
            netValue: 4500,
            paymentMethod: 'Transferência',
            status: 'PENDENTE',
            dueDate: '2026-11-10',
            recurrence: 'AVULSO',
          },
          meta(CreateExpenseDto),
        ),
      ).resolves.toBeDefined();
    });

    it('rejects an invalid status instead of persisting it', async () => {
      // An unconstrained status used to persist silently and drop the record
      // out of every status-filtered report.
      await expect(
        validationPipe.transform({ status: 'NOT_A_STATUS' }, meta(UpdateRevenueDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a negative or overflowing monetary value', async () => {
      const base = {
        procedure: 'Consulta',
        specialty: 'Cardiologia',
        paymentMethod: 'Convênio',
        dueDate: '2026-11-15',
      };
      await expect(
        validationPipe.transform({ ...base, grossValue: -100 }, meta(CreateRevenueDto)),
      ).rejects.toThrow(BadRequestException);
      // decimal(10,2) tops out below this; MySQL would 500 or truncate.
      await expect(
        validationPipe.transform({ ...base, grossValue: 1e12 }, meta(CreateRevenueDto)),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a malformed reference month on transfer generation', async () => {
      // Was an inline TS type (`{ month: string }`), which validates nothing
      // at runtime: a garbage month produced an empty date range, not a 400.
      await expect(
        validationPipe.transform({ month: 'outubro' }, meta(GenerateTransfersDto)),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validationPipe.transform({ month: '2026-13' }, meta(GenerateTransfersDto)),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validationPipe.transform({ month: '2026-10' }, meta(GenerateTransfersDto)),
      ).resolves.toEqual({ month: '2026-10' });
    });

    it('constrains the glosa status transition payload', async () => {
      await expect(
        validationPipe.transform({ status: 'INVENTADO' }, meta(UpdateRevenueStatusDto)),
      ).rejects.toThrow(BadRequestException);
      await expect(
        validationPipe.transform(
          { status: 'GLOSADO', glosaValue: 50, glosaReason: 'Divergência' },
          meta(UpdateRevenueStatusDto),
        ),
      ).resolves.toBeDefined();
    });

    it('rejects an unknown property outright', async () => {
      await expect(
        validationPipe.transform({ somethingElse: 'x' }, meta(UpdateRevenueDto)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Layer 2: service copies only allow-listed fields', () => {
    let service: FinancialService;
    let revenueRepo: jest.Mocked<Repository<any>>;
    let expenseRepo: jest.Mocked<Repository<any>>;
    let settingsRepo: jest.Mocked<Repository<any>>;
    let cashflowRepo: jest.Mocked<Repository<any>>;
    let convenioRepo: jest.Mocked<Repository<any>>;

    beforeEach(() => {
      revenueRepo = repoStub([
        {
          id: RECORD_ID,
          clinicId: CLINIC_A,
          procedure: 'Consulta',
          grossValue: 100,
          discountValue: 0,
          netValue: 100,
          status: 'PENDENTE',
        },
      ]);
      expenseRepo = repoStub([
        {
          id: RECORD_ID,
          clinicId: CLINIC_A,
          category: 'Aluguel',
          grossValue: 100,
          taxValue: 0,
          netValue: 100,
          status: 'PENDENTE',
        },
      ]);
      settingsRepo = repoStub([{ id: RECORD_ID, clinicId: CLINIC_A, issRate: 5 }]);
      cashflowRepo = repoStub();
      convenioRepo = repoStub([{ id: RECORD_ID, clinicId: CLINIC_A, name: 'Unimed' }]);

      service = new FinancialService(
        settingsRepo,
        repoStub(), // costCenterRepo
        convenioRepo,
        repoStub(), // convenioProcedureRepo
        repoStub(), // convenioPlanRepo
        revenueRepo,
        expenseRepo,
        repoStub(), // transferRepo
        cashflowRepo,
        repoStub(), // clinicMembershipRepo
        repoStub(), // tussProcedureRepo
      );
    });

    it('ignores clinicId in the body when updating a revenue', async () => {
      // The headline attack: admin of clinic A tries to move a receivable
      // into clinic B.
      const result = await service.updateRevenue(CLINIC_A, RECORD_ID, {
        clinicId: CLINIC_B,
        notes: 'legit change',
      } as any);

      expect(result.clinicId).toBe(CLINIC_A);
      expect(result.notes).toBe('legit change');
    });

    it('ignores id in the body when updating a revenue', async () => {
      const result = await service.updateRevenue(CLINIC_A, RECORD_ID, {
        id: OTHER_RECORD_ID,
      } as any);
      expect(result.id).toBe(RECORD_ID);
    });

    it('ignores clinicId when creating a revenue', async () => {
      const result = await service.createRevenue(CLINIC_A, {
        procedure: 'Consulta',
        specialty: 'Cardiologia',
        grossValue: 200,
        paymentMethod: 'Convênio',
        dueDate: '2026-11-15',
        clinicId: CLINIC_B,
      } as any);
      expect(result.clinicId).toBe(CLINIC_A);
    });

    it('recomputes netValue instead of trusting the payload', async () => {
      // A receivable booked with a total unrelated to its gross/discount.
      const result = await service.createRevenue(CLINIC_A, {
        procedure: 'Consulta',
        specialty: 'Cardiologia',
        grossValue: 1000,
        discountValue: 100,
        netValue: 1,
        paymentMethod: 'Convênio',
        dueDate: '2026-11-15',
      } as any);
      expect(result.netValue).toBe(900);
    });

    it('recomputes expense netValue instead of trusting the payload', async () => {
      const result = await service.createExpense(CLINIC_A, {
        category: 'Aluguel',
        provider: 'X',
        grossValue: 1000,
        taxValue: 50,
        netValue: 1,
        paymentMethod: 'Transferência',
        dueDate: '2026-11-10',
      } as any);
      expect(result.netValue).toBe(1050);
    });

    it('ignores clinicId in the body when updating an expense', async () => {
      const result = await service.updateExpense(CLINIC_A, RECORD_ID, {
        clinicId: CLINIC_B,
      } as any);
      expect(result.clinicId).toBe(CLINIC_A);
    });

    it('pins clinicId when updating settings', async () => {
      const result = await service.updateSettings(CLINIC_A, {
        clinicId: CLINIC_B,
        issRate: 3,
      } as any);
      expect(result.clinicId).toBe(CLINIC_A);
      expect(result.issRate).toBe(3);
    });

    it('forces sourceType/sourceId/reconciled on a cash-flow adjustment', async () => {
      const result = await service.createAdjustment(CLINIC_A, {
        type: 'ENTRADA',
        description: 'Ajuste',
        value: 100,
        date: '2026-10-19',
        sourceType: 'RECEITA',
        sourceId: OTHER_RECORD_ID,
        reconciled: true,
        clinicId: CLINIC_B,
      } as any);

      expect(result.sourceType).toBe('AJUSTE');
      expect(result.sourceId).toBeNull();
      expect(result.reconciled).toBe(false);
      expect(result.clinicId).toBe(CLINIC_A);
    });

    it('ignores clinicId when updating a convenio', async () => {
      const result = await service.updateConvenio(CLINIC_A, RECORD_ID, {
        clinicId: CLINIC_B,
        name: 'Renamed',
      } as any);
      expect(result.clinicId).toBe(CLINIC_A);
      expect(result.name).toBe('Renamed');
    });

    it('does not blank out fields the client did not send', async () => {
      // Partial updates must stay partial: `undefined` is skipped so a
      // one-field edit doesn't null the rest of the record.
      const result = await service.updateRevenue(CLINIC_A, RECORD_ID, {
        notes: 'only this',
      } as any);
      expect(result.procedure).toBe('Consulta');
      expect(result.grossValue).toBe(100);
    });

    it('still allows an explicit null to clear a nullable field', async () => {
      const result = await service.updateRevenue(CLINIC_A, RECORD_ID, {
        notes: null,
      } as any);
      expect(result.notes).toBeNull();
    });

    it('scopes the lookup to the clinic, so another tenant 404s', async () => {
      // Confirms the pre-existing tenant scoping still holds: the record
      // belongs to clinic A, so clinic B can't reach it at all.
      await expect(
        service.updateRevenue(CLINIC_B, RECORD_ID, { notes: 'x' } as any),
      ).rejects.toThrow('Revenue not found');
    });
  });
});
