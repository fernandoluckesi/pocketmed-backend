import { Repository } from 'typeorm';
import { CnesEstablishment } from '../entities/cnes-establishment.entity';

/**
 * Fetch-and-upsert logic against the government's public CNES API, shared
 * between two very different callers:
 *  - `CnesService` (NestJS-injectable): syncs ONE município on demand, the
 *    first time a patient searches for a clinic in it — capped low so an
 *    interactive search stays fast.
 *  - `seed-cnes-establishments.ts` (plain CLI script, no NestJS DI): syncs
 *    EVERY município in Brazil for a complete local database — uncapped,
 *    meant to run for hours, unattended.
 * Both need the exact same parsing/upsert behavior, so it lives here once
 * instead of being duplicated (and risking drift) between the two.
 */

export interface CnesApiEstablishment {
  codigo_cnes: number | string;
  nome_fantasia?: string;
  nome_razao_social?: string;
  numero_cnpj?: string;
  codigo_cep_estabelecimento?: string;
  endereco_estabelecimento?: string;
  numero_estabelecimento?: string;
  bairro_estabelecimento?: string;
  codigo_municipio?: number;
  codigo_uf?: number;
  numero_telefone_estabelecimento?: string;
  endereco_email_estabelecimento?: string;
  latitude_estabelecimento_decimo_grau?: number;
  longitude_estabelecimento_decimo_grau?: number;
}

const CNES_BASE_URL = 'https://apidadosabertos.saude.gov.br';
const PAGE_SIZE = 20; // the CNES API's own hard cap for /cnes/estabelecimentos

export interface SyncMunicipioOptions {
  /** Safety ceiling on pages fetched for a single município. Interactive
   * search passes a low cap (fast); the bulk seed script passes a very
   * high one (effectively "fetch everything"). */
  maxPages?: number;
  /** Delay between page requests, to stay polite to the free government API
   * during a long unattended run. Ignored (no delay) if omitted. */
  delayMs?: number;
  onPage?: (info: { page: number; itemsThisPage: number; totalSoFar: number }) => void;
  onError?: (message: string, error?: unknown) => void;
  /** Human-readable município name (from IBGE) to store on each record. */
  municipioNome?: string | null;
  /** State abbreviation (from IBGE), e.g. "AC", to store on each record. */
  uf?: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetches every page of establishments for one município from CNES and
 * upserts them into our local cache. Returns how many were synced. */
export async function syncMunicipioEstablishments(
  repository: Repository<CnesEstablishment>,
  codigoUf: number,
  codigoMunicipio: number,
  options: SyncMunicipioOptions = {},
): Promise<number> {
  const maxPages = options.maxPages ?? 25;
  // The CNES API returns only numeric codes, never the município name or the
  // UF abbreviation, so callers pass them in (resolved from IBGE) to be stored
  // for display/readability alongside the codes.
  const municipioNome = options.municipioNome ?? null;
  const uf = options.uf ?? null;
  let offset = 0;
  let page = 0;
  let total = 0;

  while (page < maxPages) {
    const url =
      `${CNES_BASE_URL}/cnes/estabelecimentos` +
      `?codigo_uf=${codigoUf}&codigo_municipio=${codigoMunicipio}` +
      `&status=1&limit=${PAGE_SIZE}&offset=${offset}`;

    let items: CnesApiEstablishment[] = [];
    try {
      const response = await fetch(url);
      if (!response.ok) {
        options.onError?.(
          `CNES sync for município ${codigoMunicipio} failed: HTTP ${response.status}`,
        );
        break;
      }
      const data = (await response.json()) as { estabelecimentos?: CnesApiEstablishment[] };
      items = data.estabelecimentos || [];
    } catch (error) {
      options.onError?.(`CNES sync for município ${codigoMunicipio} errored`, error);
      break;
    }

    if (items.length === 0) break;

    for (const item of items) {
      await upsertEstablishment(repository, item, { municipioNome, uf });
    }
    total += items.length;
    options.onPage?.({ page, itemsThisPage: items.length, totalSoFar: total });

    offset += PAGE_SIZE;
    page++;

    if (items.length < PAGE_SIZE) break; // last page
    if (options.delayMs) await sleep(options.delayMs);
  }

  return total;
}

// The CNES source data is dirty: some records carry oversized/garbage values
// (e.g. a "telefone" with two numbers concatenated — "11- 36811652 / CEL 11 -
// 99961540", 32 chars). A single such row must not abort the whole sync with
// ER_DATA_TOO_LONG, so we defensively clamp each string field to its column's
// length before saving. Columns are also widened in a migration, but this
// keeps the import resilient regardless of the schema.
function truncate(value: string | null, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? value.slice(0, max) : value;
}

export async function upsertEstablishment(
  repository: Repository<CnesEstablishment>,
  item: CnesApiEstablishment,
  meta: { municipioNome?: string | null; uf?: string | null } = {},
): Promise<void> {
  if (!item.codigo_cnes) return;
  const codigoCnes = String(item.codigo_cnes);

  let record = await repository.findOne({ where: { codigoCnes } });
  if (!record) {
    record = repository.create({ codigoCnes });
  }

  record.nomeFantasia = truncate(
    item.nome_fantasia || item.nome_razao_social || 'Estabelecimento sem nome',
    255,
  ) as string;
  record.nomeRazaoSocial = truncate(item.nome_razao_social || null, 255);
  record.cnpj = truncate(item.numero_cnpj || null, 18);
  record.cep = truncate(item.codigo_cep_estabelecimento || null, 9);
  record.endereco = truncate(item.endereco_estabelecimento || null, 255);
  record.numero = truncate(item.numero_estabelecimento || null, 20);
  record.bairro = truncate(item.bairro_estabelecimento || null, 100);
  record.codigoMunicipio = item.codigo_municipio ?? record.codigoMunicipio;
  // Município name / UF come from IBGE (the CNES API doesn't return them).
  // Keep any previously stored value if the caller didn't provide one.
  record.municipioNome = truncate(meta.municipioNome ?? record.municipioNome ?? null, 120);
  record.codigoUf = item.codigo_uf ?? record.codigoUf;
  record.uf = meta.uf ?? record.uf ?? null;
  record.telefone = truncate(item.numero_telefone_estabelecimento || null, 60);
  record.email = truncate(item.endereco_email_estabelecimento || null, 255);
  record.latitude = item.latitude_estabelecimento_decimo_grau ?? null;
  record.longitude = item.longitude_estabelecimento_decimo_grau ?? null;
  record.syncedAt = new Date();

  await repository.save(record);
}
