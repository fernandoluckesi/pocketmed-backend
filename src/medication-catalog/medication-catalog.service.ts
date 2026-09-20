import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicationCatalog } from '../entities/medication-catalog.entity';
import { ListMedicationCatalogQueryDto } from './dto/list-medication-catalog.query.dto';

export interface PaginatedMedicationCatalog {
  data: MedicationCatalog[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class MedicationCatalogService {
  constructor(
    @InjectRepository(MedicationCatalog)
    private medicationCatalogRepository: Repository<MedicationCatalog>,
  ) {}

  async findAll(query: ListMedicationCatalogQueryDto): Promise<PaginatedMedicationCatalog> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // The catalog has ~26k entries (one row per commercial presentation) — an
    // unfiltered listing isn't useful, so a search term is required.
    if (!query.search || query.search.trim().length < 2) {
      return { data: [], total: 0, page, limit };
    }

    const searchTerm = `%${query.search.trim().toLowerCase()}%`;

    const qb = this.medicationCatalogRepository
      .createQueryBuilder('med')
      .where('(LOWER(med.product) LIKE :search OR LOWER(med.substance) LIKE :search)', {
        search: searchTerm,
      })
      .orderBy('med.product', 'ASC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, limit };
  }
}
