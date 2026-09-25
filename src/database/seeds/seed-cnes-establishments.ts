import 'reflect-metadata';
import 'dotenv/config';
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

  for (const uf of TARGET_UFS) {
    let municipios: { codigoMunicipio: number; codigoUf: number; nome: string }[];
    try {
      municipios = await ibgeService.listMunicipios(uf);
    } catch (error) {
      console.error(`✗ Falha ao listar municípios de ${uf}:`, error);
      continue;
    }

    totalCities += municipios.length;
    console.log(`\n${uf}: ${municipios.length} município(s)`);

    for (const m of municipios) {
      const progress = `[${citiesDone + citiesSkipped + citiesFailed + 1}/${totalCities}]`;

      // Everything here — including the "already synced?" check — is
      // inside one try/catch. A multi-hour unattended run WILL hit
      // transient DB/network blips eventually (confirmed live: a dropped
      // connection to local MySQL mid-run); one bad city must not take the
      // whole script down. The connection pool recovers on its own for the
      // next query, so just counting this city as failed and moving on is
      // enough — nothing needs to be torn down or reconnected by hand.
      try {
        if (!FORCE) {
          const alreadySynced = await repository.count({
            where: { codigoMunicipio: m.codigoMunicipio },
          });
          if (alreadySynced > 0) {
            citiesSkipped++;
            continue;
          }
        }

        const count = await syncMunicipioEstablishments(repository, m.codigoUf, m.codigoMunicipio, {
          maxPages: MAX_PAGES_PER_MUNICIPIO,
          delayMs: DELAY_MS,
          onError: (message) => console.warn(`  ⚠ ${message}`),
        });
        establishmentsSynced += count;
        citiesDone++;
        console.log(`  ${progress} ${m.nome}/${uf}: ${count} estabelecimento(s)`);
      } catch (error) {
        citiesFailed++;
        console.error(`  ${progress} ${m.nome}/${uf}: falhou —`, error);
      }

      if (DELAY_MS) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(
    `Concluído em ${formatDuration(Date.now() - startedAt)}: ` +
      `${citiesDone} cidade(s) sincronizadas, ${citiesSkipped} já feitas (puladas), ` +
      `${citiesFailed} falharam, ${establishmentsSynced} estabelecimento(s) no total.`,
  );
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
