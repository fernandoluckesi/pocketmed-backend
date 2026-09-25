import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamCatalog } from '../entities/exam-catalog.entity';
import { ExamCategory } from '../entities/exam-category.entity';
import { ListExamCatalogQueryDto } from './dto/list-exam-catalog.query.dto';

export interface PaginatedExamCatalog {
  data: ExamCatalog[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ExamCatalogService {
  constructor(
    @InjectRepository(ExamCatalog)
    private examCatalogRepository: Repository<ExamCatalog>,
    @InjectRepository(ExamCategory)
    private examCategoryRepository: Repository<ExamCategory>,
  ) {}

  async findAll(query: ListExamCatalogQueryDto): Promise<PaginatedExamCatalog> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.examCatalogRepository
      .createQueryBuilder('exam')
      .leftJoinAndSelect('exam.category', 'category')
      .where('exam.isActive = :isActive', { isActive: true });

    // Search filter: LIKE on name or synonyms (case-insensitive via LOWER())
    if (query.search) {
      const searchTerm = `%${query.search.toLowerCase()}%`;
      qb.andWhere('(LOWER(exam.name) LIKE :search OR LOWER(exam.synonyms) LIKE :search)', {
        search: searchTerm,
      });
    }

    // Category filter: match by name first, then by id
    if (query.category) {
      const categoryByName = await this.examCategoryRepository
        .createQueryBuilder('cat')
        .where('LOWER(cat.name) = LOWER(:name)', { name: query.category })
        .getOne();

      if (categoryByName) {
        qb.andWhere('exam.categoryId = :categoryId', {
          categoryId: categoryByName.id,
        });
      } else {
        // Try matching by id
        qb.andWhere('exam.categoryId = :categoryId', {
          categoryId: query.category,
        });
      }
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, limit };
  }

  async findAllCategories(): Promise<Pick<ExamCategory, 'id' | 'name'>[]> {
    const categories = await this.examCategoryRepository.find({
      select: ['id', 'name'],
      order: { name: 'ASC' },
    });
    return categories;
  }
}
