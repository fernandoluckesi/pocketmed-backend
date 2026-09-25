import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { CnesEstablishment } from '../entities/cnes-establishment.entity';
import { IbgeService } from './ibge.service';
import { syncMunicipioEstablishments } from './cnes-sync';

// Bounds an interactive, on-demand sync (first search in a município) to
// ~500 establishments so a patient isn't stuck waiting. The bulk national
// import (`seed-cnes-establishments.ts`) uses the same underlying sync
// logic with no such cap — see `cnes-sync.ts`.
const ON_DEMAND_MAX_PAGES = 25;

@Injectable()
export class CnesService {
  private readonly logger = new Logger(CnesService.name);

  constructor(
    @InjectRepository(CnesEstablishment)
    private establishmentRepository: Repository<CnesEstablishment>,
    private ibgeService: IbgeService,
  ) {}

  /** Searches real health establishments by name within a município. The
   * CNES API itself has no name filter, so this always resolves against
   * our local cache — syncing that município from CNES first if it has
   * never been searched before (empty cache ≠ "no matches", it means
   * "never synced"). If the bulk national import has already covered this
   * município, this never re-syncs it — it just searches the cache. */
  async search(nome: string, uf: string, cidade: string): Promise<CnesEstablishment[]> {
    const resolved = await this.ibgeService.resolveMunicipio(uf, cidade);
    if (!resolved) return [];

    const { codigoMunicipio, codigoUf } = resolved;

    const alreadySynced = await this.establishmentRepository.count({
      where: { codigoMunicipio },
    });
    if (alreadySynced === 0) {
      const total = await syncMunicipioEstablishments(
        this.establishmentRepository,
        codigoUf,
        codigoMunicipio,
        {
          maxPages: ON_DEMAND_MAX_PAGES,
          onError: (message, error) => this.logger.warn(message, error),
        },
      );
      this.logger.log(`Synced ${total} CNES establishment(s) for município ${codigoMunicipio}`);
    }

    return this.findLocal(nome, codigoMunicipio);
  }

  private async findLocal(nome: string, codigoMunicipio: number): Promise<CnesEstablishment[]> {
    return this.establishmentRepository.find({
      where: { codigoMunicipio, nomeFantasia: Like(`%${nome}%`) },
      order: { nomeFantasia: 'ASC' },
      take: 15,
    });
  }
}
