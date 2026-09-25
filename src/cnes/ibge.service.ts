import { Injectable, Logger } from '@nestjs/common';

interface IbgeMunicipio {
  id: number;
  nome: string;
  ufCode: number | null;
}

/**
 * Resolves a free-text município name (as a patient types it) into the
 * codes the CNES API actually filters by. Backed by IBGE's public,
 * unauthenticated "localidades" API — município boundaries essentially
 * never change, so the per-UF list is cached in memory for the process
 * lifetime rather than re-fetched on every search.
 */
@Injectable()
export class IbgeService {
  private readonly logger = new Logger(IbgeService.name);
  private readonly cache = new Map<string, IbgeMunicipio[]>();

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  /** Every município in a state, with its CNES-style 6-digit code already
   * resolved — used by the bulk national import to enumerate all 5,569
   * municípios in Brazil (loop the 27 UFs, then this per UF). */
  async listMunicipios(
    uf: string,
  ): Promise<{ codigoMunicipio: number; codigoUf: number; nome: string }[]> {
    const list = await this.loadMunicipios(uf);
    return list
      .filter((m) => m.ufCode !== null)
      .map((m) => ({
        codigoMunicipio: Math.floor(m.id / 10),
        codigoUf: m.ufCode as number,
        nome: m.nome,
      }));
  }

  private async loadMunicipios(uf: string): Promise<IbgeMunicipio[]> {
    const key = uf.toUpperCase();
    const cached = this.cache.get(key);
    if (cached) return cached;

    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${key}/municipios`,
    );
    if (!response.ok) {
      throw new Error(`IBGE municipios lookup failed for UF ${key}: HTTP ${response.status}`);
    }
    const data = (await response.json()) as any[];
    const list: IbgeMunicipio[] = data.map((m) => ({
      id: m.id,
      nome: m.nome,
      ufCode: m?.microrregiao?.mesorregiao?.UF?.id ?? null,
    }));
    this.cache.set(key, list);
    return list;
  }

  /** Returns the CNES-style 6-digit município code (IBGE's 7-digit code
   * minus its trailing check digit) and the numeric UF code, or `null` if
   * the typed cidade name doesn't match any município in that state. */
  async resolveMunicipio(
    uf: string,
    cidadeNome: string,
  ): Promise<{ codigoMunicipio: number; codigoUf: number } | null> {
    let list: IbgeMunicipio[];
    try {
      list = await this.loadMunicipios(uf);
    } catch (error) {
      this.logger.warn(`Failed to load municípios for UF ${uf}`, error);
      return null;
    }

    const target = this.normalize(cidadeNome);
    const match =
      list.find((m) => this.normalize(m.nome) === target) ||
      list.find((m) => this.normalize(m.nome).startsWith(target));

    if (!match || match.ufCode === null) return null;

    return {
      codigoMunicipio: Math.floor(match.id / 10),
      codigoUf: match.ufCode,
    };
  }
}
