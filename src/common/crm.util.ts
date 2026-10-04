/**
 * Single source of truth for CRM parsing/formatting on the backend.
 *
 * Historically the CRM was stored as one free-text string in several
 * incompatible shapes, depending on which client created the account:
 *   "123456/SP"    web signup
 *   "SP-123456"    mobile
 *   "CRM-SP-00001" clinic seed
 *   "SEC00001"     synthetic, for secretaries (no real CRM)
 *
 * That had a real consequence: uniqueness checks compared the raw string, so
 * "123456/SP" and "SP-123456" were treated as two different doctors — the
 * same registration could be created twice. Searching had to try both shapes
 * explicitly, and every client grew its own parser (three in mobile alone).
 *
 * `doctors.crmNumber` + `doctors.crmUf` are now the source of truth. The
 * legacy `crm` column is kept in sync in canonical form so mobile and
 * backoffice (deployed separately, on their own schedule) keep working.
 */

export const BRAZILIAN_UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export type BrazilianUf = (typeof BRAZILIAN_UFS)[number];

const UF_SET = new Set<string>(BRAZILIAN_UFS);

export function isValidUf(value?: string | null): boolean {
  return !!value && UF_SET.has(value.trim().toUpperCase());
}

export interface ParsedCrm {
  /** Digits only, leading zeros preserved. Empty when unparseable. */
  number: string;
  /** Valid UF in uppercase, or empty when absent/invalid. */
  uf: string;
}

/**
 * Reads number + UF out of any of the legacy shapes. Returns empty strings
 * rather than throwing: this also runs over pre-existing rows, including
 * synthetic CRMs ("SEC00001") that never had a UF to begin with.
 */
export function parseCrm(raw?: string | null): ParsedCrm {
  if (!raw) return { number: '', uf: '' };

  const value = String(raw).trim();
  if (!value) return { number: '', uf: '' };

  // Collect every 2-letter run as a UF candidate and every digit run as a
  // number candidate, instead of matching a fixed list of layouts. This
  // covers "123456/SP", "SP-123456", "CRM-SP-00001" and "CRM/SP 123456"
  // with one rule, and tolerates the separators seen in real data.
  // Match *whole* letter runs and keep only those exactly 2 chars long —
  // not any 2-letter substring. Otherwise "SEC00001" (synthetic secretary
  // CRM) would yield UF "SE" (Sergipe) from inside the word "SEC", and
  // "CRM..." would be scanned for UFs inside the prefix itself.
  const letterRuns: string[] = value.toUpperCase().match(/[A-Z]+/g) ?? [];
  const ufCandidates = letterRuns.filter(
    (candidate) => candidate.length === 2 && UF_SET.has(candidate),
  );

  const digitRuns: string[] = value.match(/\d+/g) ?? [];

  // The CRM number is the longest digit run: "CRM-SP-00001" has only one,
  // but a stray year or sequence elsewhere shouldn't outrank the registration
  // number itself.
  let number = '';
  for (const run of digitRuns) {
    if (run.length > number.length) number = run;
  }

  return { number, uf: ufCandidates[0] || '' };
}

/**
 * Canonical stored form: "123456/SP". Written back to the legacy `crm`
 * column so older clients keep reading a single, now-predictable shape.
 * Falls back to the original string when there's nothing to normalize
 * (synthetic CRMs), so no data is silently destroyed.
 */
export function formatCrm(number?: string | null, uf?: string | null): string {
  const digits = String(number || '').trim();
  const state = String(uf || '')
    .trim()
    .toUpperCase();

  if (!digits) return '';
  return state ? `${digits}/${state}` : digits;
}

/** Normalizes any legacy shape into the canonical form in one step. */
export function canonicalizeCrm(raw?: string | null): string {
  const { number, uf } = parseCrm(raw);
  if (!number) return String(raw || '').trim();
  return formatCrm(number, uf);
}

export interface CrmInput {
  crm?: string | null;
  crmNumber?: string | null;
  crmUf?: string | null;
}

export interface ResolvedCrm {
  /** Canonical string for the legacy `crm` column. */
  crm: string;
  crmNumber: string | null;
  crmUf: string | null;
}

/**
 * Resolves a write payload into the three values that get persisted,
 * accepting either the new separate fields or the legacy combined string.
 *
 * Clients migrate at their own pace (mobile and backoffice ship separately),
 * so both input shapes have to work during the transition. Explicit
 * `crmNumber`/`crmUf` win when present; otherwise the combined string is
 * parsed. Keeping this in one function is what stops the old situation —
 * where each caller invented its own concatenation — from coming back.
 */
export function resolveCrmInput(input: CrmInput): ResolvedCrm {
  const explicitNumber = String(input.crmNumber || '').trim();
  const explicitUf = String(input.crmUf || '')
    .trim()
    .toUpperCase();

  if (explicitNumber) {
    const uf = isValidUf(explicitUf) ? explicitUf : '';
    return {
      crm: formatCrm(explicitNumber, uf),
      crmNumber: explicitNumber,
      crmUf: uf || null,
    };
  }

  const { number, uf } = parseCrm(input.crm);
  if (!number) {
    // Nothing parseable (e.g. a synthetic "SEC..." CRM): keep the raw value
    // in the legacy column and leave the structured fields empty, rather
    // than inventing data.
    return {
      crm: String(input.crm || '').trim(),
      crmNumber: null,
      crmUf: null,
    };
  }

  return {
    crm: formatCrm(number, uf),
    crmNumber: number,
    crmUf: uf || null,
  };
}
