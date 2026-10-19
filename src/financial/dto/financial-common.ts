/**
 * Shared pieces for the financial DTOs.
 *
 * Why these DTOs exist at all: every write endpoint in this module used to
 * take `@Body() dto: any` and persist it with `Object.assign(entity, dto)` /
 * `create({ ...dto })`. The global ValidationPipe in main.ts has
 * `whitelist: true` + `forbidNonWhitelisted: true`, but both are inert
 * without a DTO *class* to validate against — `any` opted every one of these
 * endpoints out of the protection the rest of the app relies on.
 *
 * The concrete risk that closes: an authenticated admin of clinic A could
 * send `{ "clinicId": "<clinic-B-id>" }` on any update and move a financial
 * record into another clinic, or send `{ "id": "<other-record>" }` and have
 * TypeORM overwrite a different row than the URL addressed. Server-derived
 * fields (`id`, `clinicId`, `netValue`, `paidAt`, computed totals) are
 * therefore deliberately absent from every DTO below: anything not declared
 * here is rejected with a 400 before reaching the service.
 */

/**
 * Values accepted for a payable/receivable's lifecycle status.
 *
 * Kept as a const array (not a TS enum) so it can be used both as a runtime
 * whitelist for @IsIn and as a compile-time type. The service compares these
 * as plain strings and branches on 'PAGO' to write cash-flow entries, so an
 * unconstrained string here previously meant a typo'd status (or an invented
 * one) would persist silently and quietly drop the record out of every
 * status-filtered report and summary.
 */
export const FINANCIAL_STATUSES = ['PENDENTE', 'PAGO', 'GLOSADO', 'CANCELADO', 'ATRASADO'] as const;
export type FinancialStatus = (typeof FINANCIAL_STATUSES)[number];

/** Cash-flow direction. 'ENTRADA' = money in, 'SAIDA' = money out. */
export const CASHFLOW_TYPES = ['ENTRADA', 'SAIDA'] as const;
export type CashflowType = (typeof CASHFLOW_TYPES)[number];

/**
 * Tax regimes used by the DRE/transfer math. Mirrors the default written in
 * `getSettings` ('SIMPLES_NACIONAL').
 */
export const TAX_REGIMES = ['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI'] as const;
export type TaxRegime = (typeof TAX_REGIMES)[number];

/**
 * Upper bound for monetary fields. Guards against a fat-fingered or
 * malicious value overflowing `decimal(10,2)` (max 99.999.999,99), which
 * MySQL would otherwise reject with a 500 at insert time, or silently
 * truncate depending on strict mode.
 */
export const MAX_MONETARY_VALUE = 99999999.99;

/** Percentage fields are stored as decimal(5,2): 0.00–999.99 by column, but
 * only 0–100 is meaningful for a rate. */
export const MAX_PERCENTAGE = 100;
