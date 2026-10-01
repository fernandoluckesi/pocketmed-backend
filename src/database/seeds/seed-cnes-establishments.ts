import 'reflect-metadata';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import AppDataSource from '../data-source';
import { CnesEstablishment } from '../../entities/cnes-establishment.entity';
import { IbgeService } from '../../cnes/ibge.service';
import { syncMunicipioEstablishments } from '../../cnes/cnes-sync';

/**
 * Bulk national import: syncs EVERY município in Brazil's real health
 * establishment data (CNES) into our local database, so clinic-name search
 * works everywhere without waiting on a live sync the first time someone
 * searches in a given city.
 *
 * This is a long-running, unattended job — thousands of municípios, each
 * needing one or more paginated requests to a free government API — so it
 * runs as a plain CLI script against whatever database `.env` points to
 * (local to test, or the production `MYSQL_PUBLIC_URL` when you're ready
 * to run it for real — same pattern already used for migrations), not as
 * an HTTP endpoint (it would blow past any request timeout long before
 * finishing).
 *
 * Resumable: a município already present in `cnes_establishments` is
 * skipped, so if this dies partway through (closed terminal, network
 * drop), just run it again — it picks up where it left off. Set
 * CNES_SYNC_FORCE=true to re-sync municípios that were already done.
 *
 * Usage:
 *   yarn seed:cnes                        # all 27 states, resumable
 *   CNES_SYNC_UF=SP,RJ yarn seed:cnes     # only these states
 *   CNES_SYNC_DELAY_MS=300 yarn seed:cnes # slower/more polite to the API
 *   CNES_SYNC_FORCE=true yarn seed:cnes   # re-sync even already-done cities
 */

const ALL_UFS = [
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
];

// High enough to never realistically be hit — even São Paulo's capital
// doesn't have 40,000 active establishments — just a safety valve against
// a runaway loop, not a real cap on completeness.
const MAX_PAGES_PER_MUNICIPIO = 2000;

const DELAY_MS = Number(process.env.CNES_SYNC_DELAY_MS || 150);
const FORCE = process.env.CNES_SYNC_FORCE === 'true';

// When set to a failures JSON file (produced by a previous run), reprocess ONLY
// those municípios and force re-sync them (so ones left half-synced by a dropped
// connection are corrected, not skipped for already having some rows).
const FAILURES_ONLY_FILE = process.env.CNES_SYNC_FAILURES_ONLY || '';

const TARGET_UFS = process.env.CNES_SYNC_UF
  ? process.env.CNES_SYNC_UF.split(',').map((uf) => uf.trim().toUpperCase())
  : ALL_UFS;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
}

export async function seedCnesEstablishments() {
  // Safety guard: this seed can write to the PRODUCTION database (it is meant to
  // be run locally, pointing at Railway's MYSQL_PUBLIC_URL/DATABASE_URL). Writing
  // to a remote DB is a high-impact action, so when a connection URL is present
  // we require an explicit CNES_SYNC_CONFIRM=true to avoid accidental runs
  // against the wrong environment.
  const targetUrl =
    process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;
  if (targetUrl && process.env.CNES_SYNC_CONFIRM !== 'true') {
    const host = (() => {
      try {
        return new URL(targetUrl).host;
      } catch {
        return '(host desconhecido)';
      }
    })();
    console.error(
      '\n⚠  Este seed vai ESCREVER no banco remoto:\n' +
        `   ${host}\n\n` +
        '   Para confirmar que é intencional, rode novamente com CNES_SYNC_CONFIRM=true.\n' +
        '   Ex.: DATABASE_URL="<url-prod>" CNES_SYNC_CONFIRM=true yarn seed:cnes\n',
    );
    process.exit(1);
  }

  const shouldDestroyConnection = !AppDataSource.isInitialized;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const repository = AppDataSource.getRepository(CnesEstablishment);
  const ibgeService = new IbgeService();

  console.log('── Sincronização nacional CNES ──────────────────────────');
  console.log(`Estados: ${TARGET_UFS.join(', ')}`);
  console.log(`Delay entre páginas: ${DELAY_MS}ms | Forçar re-sync: ${FORCE}`);
  console.log('──────────────────────────────────────────────────────────');

  const startedAt = Date.now();
  let citiesDone = 0;
  let citiesSkipped = 0;
  let citiesFailed = 0;
  let establishmentsSynced = 0;
  let totalCities = 0;
  // Municípios that failed (network/DB errors after retries) — persisted to a
  // JSON file at the end so you can review/reprocess exactly what didn't sync,
  // instead of losing that info when the terminal closes.
  const failures: {
    uf: string;
    codigoMunicipio: number;
    codigoUf: number;
    nome: string;
    error: string;
  }[] = [];

  // Build the list of municípios to process. Two modes:
  //  - Failures-only: read a previous run's failures file and reprocess ONLY
  //    those (forced re-sync so half-synced ones are corrected).
  //  - Normal: enumerate every município of each target UF from IBGE.
  type MunicipioToProcess = {
    codigoMunicipio: number;
    codigoUf: number;
    nome: string;
    uf: string;
  };
  const municipiosToProcess: MunicipioToProcess[] = [];

  if (FAILURES_ONLY_FILE) {
    try {
      const parsed = JSON.parse(fs.readFileSync(FAILURES_ONLY_FILE, 'utf8')) as MunicipioToProcess[];
      for (const f of parsed) {
        municipiosToProcess.push({
          codigoMunicipio: f.codigoMunicipio,
          codigoUf: f.codigoUf,
          nome: f.nome,
          uf: f.uf,
        });
      }
      console.log(`Modo reprocessamento: ${municipiosToProcess.length} município(s) do arquivo de falhas.`);
    } catch (error) {
      console.error(`✗ Não foi possível ler o arquivo de falhas ${FAILURES_ONLY_FILE}:`, error);
      if (shouldDestroyConnection && AppDataSource.isInitialized) await AppDataSource.destroy();
      process.exit(1);
    }
  } else {
    for (const uf of TARGET_UFS) {
      try {
        const municipios = await ibgeService.listMunicipios(uf);
        for (const m of municipios) municipiosToProcess.push({ ...m, uf });
      } catch (error) {
        console.error(`✗ Falha ao listar municípios de ${uf}:`, error);
      }
    }
  }

  totalCities = municipiosToProcess.length;

  {
    for (const m of municipiosToProcess) {
      const uf = m.uf;
      // Failures-only reprocessing forces re-sync so half-synced municípios
      // (dropped mid-way) get completed instead of skipped.
      const forceThis = FORCE || Boolean(FAILURES_ONLY_FILE);
      const progress = `[${citiesDone + citiesSkipped + citiesFailed + 1}/${totalCities}]`;

      // Everything here — including the "already synced?" check — is
      // inside one try/catch. A multi-hour unattended run WILL hit
      // transient DB/network blips eventually (confirmed live: a dropped
      // connection to local MySQL mid-run); one bad city must not take the
      // whole script down. The connection pool recovers on its own for the
      // next query, so just counting this city as failed and moving on is
      // enough — nothing needs to be torn down or reconnected by hand.
      try {
        if (!forceThis) {
          const alreadySynced = await repository.count({
            where: { codigoMunicipio: m.codigoMunicipio },
          });
          if (alreadySynced > 0) {
            citiesSkipped++;
            continue;
          }
        }

        // Retry the município a few times on transient DB/network failures
        // (ECONNRESET/timeouts are common over Railway's public proxy on a
        // multi-hour run). Only network-ish errors are retried; a clean run
        // that simply found 0 establishments is not an error.
        const MAX_ATTEMPTS = 3;
        let count = 0;
        let lastError: unknown = null;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            count = await syncMunicipioEstablishments(repository, m.codigoUf, m.codigoMunicipio, {
              maxPages: MAX_PAGES_PER_MUNICIPIO,
              delayMs: DELAY_MS,
              municipioNome: m.nome,
              uf,
              onError: (message) => console.warn(`  ⚠ ${message}`),
            });
            lastError = null;
            break;
          } catch (err) {
            lastError = err;
            const code = (err as { code?: string })?.code ?? '';
            const retriable =
              code === 'ECONNRESET' ||
              code === 'PROTOCOL_CONNECTION_LOST' ||
              code === 'ETIMEDOUT' ||
              code === 'ECONNREFUSED';
            if (!retriable || attempt === MAX_ATTEMPTS) break;
            const backoff = 1000 * attempt;
            console.warn(
              `  ↻ ${progress} ${m.nome}/${uf}: ${code || 'erro'} — nova tentativa ${attempt + 1}/${MAX_ATTEMPTS} em ${backoff}ms`,
            );
            await new Promise((resolve) => setTimeout(resolve, backoff));
          }
        }

        if (lastError) {
          citiesFailed++;
          failures.push({
            uf,
            codigoMunicipio: m.codigoMunicipio,
            codigoUf: m.codigoUf,
            nome: m.nome,
            error: (lastError as { code?: string })?.code || String(lastError),
          });
          console.error(`  ${progress} ${m.nome}/${uf}: falhou —`, lastError);
        } else {
          establishmentsSynced += count;
          citiesDone++;
          console.log(`  ${progress} ${m.nome}/${uf}: ${count} estabelecimento(s)`);
        }
      } catch (error) {
        citiesFailed++;
        failures.push({
          uf,
          codigoMunicipio: m.codigoMunicipio,
          codigoUf: m.codigoUf,
          nome: m.nome,
          error: (error as { code?: string })?.code || String(error),
        });
        console.error(`  ${progress} ${m.nome}/${uf}: falhou —`, error);
      }

      if (DELAY_MS) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  // Persist the list of failed municípios so it survives the terminal closing.
  // Reprocess later with CNES_SYNC_FAILURES_ONLY=<file> (see usage on top).
  let failuresFile: string | null = null;
  if (failures.length > 0) {
    const dir = path.join(process.cwd(), 'cnes-sync-logs');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    failuresFile = path.join(dir, `cnes-failures-${stamp}.json`);
    fs.writeFileSync(failuresFile, JSON.stringify(failures, null, 2));
  }

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(
    `Concluído em ${formatDuration(Date.now() - startedAt)}: ` +
      `${citiesDone} cidade(s) sincronizadas, ${citiesSkipped} já feitas (puladas), ` +
      `${citiesFailed} falharam, ${establishmentsSynced} estabelecimento(s) no total.`,
  );
  if (failuresFile) {
    console.log(`Municípios que falharam salvos em: ${failuresFile}`);
    console.log('Reprocesse-os com:');
    console.log(`  CNES_SYNC_FAILURES_ONLY="${failuresFile}" CNES_SYNC_CONFIRM=true yarn seed:cnes`);
  }
  console.log('──────────────────────────────────────────────────────────');

  if (shouldDestroyConnection && AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  seedCnesEstablishments().catch(async (error) => {
    console.error('Erro ao executar sincronização nacional CNES:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  });
}
