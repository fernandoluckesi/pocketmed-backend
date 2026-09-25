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
      await upsertEstablishment(repository, item);
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

export async function upsertEstablishment(
  repository: Repository<CnesEstablishment>,
  item: CnesApiEstablishment,
): Promise<void> {
  if (!item.codigo_cnes) return;
  const codigoCnes = String(item.codigo_cnes);

  let record = await repository.findOne({ where: { codigoCnes } });
  if (!record) {
    record = repository.create({ codigoCnes });
  }

  record.nomeFantasia = item.nome_fantasia || item.nome_razao_social || 'Estabelecimento sem nome';
  record.nomeRazaoSocial = item.nome_razao_social || null;
  record.cnpj = item.numero_cnpj || null;
  record.cep = item.codigo_cep_estabelecimento || null;
  record.endereco = item.endereco_estabelecimento || null;
  record.numero = item.numero_estabelecimento || null;
  record.bairro = item.bairro_estabelecimento || null;
  record.codigoMunicipio = item.codigo_municipio ?? record.codigoMunicipio;
  record.codigoUf = item.codigo_uf ?? record.codigoUf;
  record.telefone = item.numero_telefone_estabelecimento || null;
  record.email = item.endereco_email_estabelecimento || null;
  record.latitude = item.latitude_estabelecimento_decimo_grau ?? null;
  record.longitude = item.longitude_estabelecimento_decimo_grau ?? null;
  record.syncedAt = new Date();

  await repository.save(record);
}
