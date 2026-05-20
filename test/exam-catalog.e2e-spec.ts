import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp } from './test-utils';
import { ExamCatalog } from '../src/entities/exam-catalog.entity';
import { ExamCategory } from '../src/entities/exam-category.entity';

describe('Exam Catalog Module (e2e)', () => {
  let app: INestApplication;
  let examCatalogRepo: Repository<ExamCatalog>;
  let examCategoryRepo: Repository<ExamCategory>;

  beforeAll(async () => {
    app = await createTestApp();

    examCatalogRepo = app.get(getRepositoryToken(ExamCatalog));
    examCategoryRepo = app.get(getRepositoryToken(ExamCategory));

    // Seed categories
    const categories = await examCategoryRepo.save([
      { name: 'Hematologia' },
      { name: 'Bioquímica' },
      { name: 'Imagem' },
    ]);

    const hematologia = categories.find((c) => c.name === 'Hematologia');
    const bioquimica = categories.find((c) => c.name === 'Bioquímica');
    const imagem = categories.find((c) => c.name === 'Imagem');

    // Seed exam catalog
    await examCatalogRepo.save([
      {
        name: 'Hemograma Completo',
        synonyms: 'CBC, hemograma',
        categoryId: hematologia.id,
        preparationInstructions: 'Jejum de 8 horas',
        estimatedDuration: 30,
        price: 45.0,
        isActive: true,
      },
      {
        name: 'Glicose em Jejum',
        synonyms: 'glicemia, glucose',
        categoryId: bioquimica.id,
        preparationInstructions: 'Jejum de 12 horas',
        estimatedDuration: 15,
        price: 25.0,
        isActive: true,
      },
      {
        name: 'Colesterol Total',
        synonyms: 'colesterol, lipidograma',
        categoryId: bioquimica.id,
        preparationInstructions: 'Jejum de 12 horas',
        estimatedDuration: 20,
        price: 35.0,
        isActive: true,
      },
      {
        name: 'Raio-X Tórax',
        synonyms: 'radiografia, rx torax',
        categoryId: imagem.id,
        preparationInstructions: 'Sem preparo',
        estimatedDuration: 15,
        price: 80.0,
        isActive: true,
      },
      {
        name: 'Ultrassonografia Abdominal',
        synonyms: 'ultrassom, ecografia',
        categoryId: imagem.id,
        preparationInstructions: 'Jejum de 6 horas',
        estimatedDuration: 40,
        price: 150.0,
        isActive: true,
      },
      {
        name: 'Exame Inativo',
        synonyms: 'inativo',
        categoryId: hematologia.id,
        preparationInstructions: null,
        estimatedDuration: 10,
        price: 10.0,
        isActive: false,
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /exam-catalog', () => {
    it('should return paginated catalog (default page 1, limit 20)', async () => {
      const res = await request(app.getHttpServer())
        .get('/exam-catalog')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 20);
      // Should only return active exams (5 active, 1 inactive)
      expect(res.body.total).toBe(5);
      expect(res.body.data).toHaveLength(5);
    });

    it('should respect pagination parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/exam-catalog?page=1&limit=2')
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(5);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
    });

    it('should search by name (case-insensitive)', async () => {
      const res = await request(app.getHttpServer())
        .get('/exam-catalog?search=hemograma')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const names = res.body.data.map((e: any) => e.name.toLowerCase());
      expect(names.some((n: string) => n.includes('hemograma'))).toBe(true);
    });

    it('should search by name case-insensitively (uppercase query)', async () => {
      const res = await request(app.getHttpServer())
        .get('/exam-catalog?search=GLICOSE')
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const names = res.body.data.map((e: any) => e.name.toLowerCase());
      expect(names.some((n: string) => n.includes('glicose'))).toBe(true);
    });

    it('should filter by category name', async () => {
      const res = await request(app.getHttpServer())
        .get('/exam-catalog?category=Bioquímica')
        .expect(200);

      expect(res.body.data.length).toBe(2);
      res.body.data.forEach((exam: any) => {
        expect(exam.category.name).toBe('Bioquímica');
      });
    });

    it('should combine search + category filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/exam-catalog?search=glicose&category=Bioquímica')
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Glicose em Jejum');
      expect(res.body.data[0].category.name).toBe('Bioquímica');
    });

    it('should return empty results with 200 for non-matching search', async () => {
      const res = await request(app.getHttpServer())
        .get('/exam-catalog?search=xyznonexistent')
        .expect(200);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });

    it('should not return inactive exams', async () => {
      const res = await request(app.getHttpServer())
        .get('/exam-catalog?search=inativo')
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /exam-catalog/categories', () => {
    it('should return all categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/exam-catalog/categories')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
      const names = res.body.map((c: any) => c.name);
      expect(names).toContain('Hematologia');
      expect(names).toContain('Bioquímica');
      expect(names).toContain('Imagem');
    });
  });
});
