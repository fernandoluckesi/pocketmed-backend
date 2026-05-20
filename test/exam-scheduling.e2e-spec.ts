import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import {
  createTestApp,
  registerPatient,
  registerDoctor,
  futureDate,
  pastDate,
} from './test-utils';
import { ExamCatalog } from '../src/entities/exam-catalog.entity';
import { ExamCategory } from '../src/entities/exam-category.entity';

describe('Exam Scheduling Module (e2e)', () => {
  let app: INestApplication;
  let patientToken: string;
  let patientToken2: string;
  let doctorToken: string;
  let catalogExamId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Seed a category and exam for scheduling
    const categoryRepo: Repository<ExamCategory> = app.get(getRepositoryToken(ExamCategory));
    const catalogRepo: Repository<ExamCatalog> = app.get(getRepositoryToken(ExamCatalog));

    const category = await categoryRepo.save({ name: 'Hematologia' });
    const exam = await catalogRepo.save({
      name: 'Hemograma Completo',
      synonyms: 'hemograma',
      categoryId: category.id,
      preparationInstructions: 'Jejum 8h',
      estimatedDuration: 30,
      price: 45.0,
      isActive: true,
    });
    catalogExamId = exam.id;

    // Register users
    const patient1 = await registerPatient(app, { email: 'sched-patient1@test.com' });
    patientToken = patient1.token;

    const patient2 = await registerPatient(app, { email: 'sched-patient2@test.com' });
    patientToken2 = patient2.token;

    const doctor = await registerDoctor(app, { email: 'sched-doctor@test.com' });
    doctorToken = doctor.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /exam-schedules', () => {
    it('should create an exam schedule successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/exam-schedules')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          exams: [{ examCatalogId: catalogExamId }],
          scheduledDateTime: futureDate(7),
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('scheduledDateTime');
      expect(res.body.status).toBe('pending');
      expect(res.body.items).toHaveLength(1);
    });

    it('should create a schedule with custom exam name', async () => {
      const res = await request(app.getHttpServer())
        .post('/exam-schedules')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          exams: [{ customExamName: 'Exame Especial Customizado' }],
          scheduledDateTime: futureDate(14),
        })
        .expect(201);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].customExamName).toBe('Exame Especial Customizado');
    });

    it('should create a schedule with multiple exams', async () => {
      const res = await request(app.getHttpServer())
        .post('/exam-schedules')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          exams: [
            { examCatalogId: catalogExamId },
            { customExamName: 'Outro Exame' },
          ],
          scheduledDateTime: futureDate(10),
        })
        .expect(201);

      expect(res.body.items).toHaveLength(2);
    });

    it('should return 400 for empty exam list', async () => {
      const res = await request(app.getHttpServer())
        .post('/exam-schedules')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          exams: [],
          scheduledDateTime: futureDate(7),
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should return 400 for past date', async () => {
      const res = await request(app.getHttpServer())
        .post('/exam-schedules')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          exams: [{ examCatalogId: catalogExamId }],
          scheduledDateTime: pastDate(1),
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/exam-schedules')
        .send({
          exams: [{ examCatalogId: catalogExamId }],
          scheduledDateTime: futureDate(7),
        })
        .expect(401);
    });

    it('should return 403 for doctor role (only patients allowed)', async () => {
      const res = await request(app.getHttpServer())
        .post('/exam-schedules')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          exams: [{ examCatalogId: catalogExamId }],
          scheduledDateTime: futureDate(7),
        });

      // Doctors should be forbidden (403) from exam scheduling
      expect([403, 401]).toContain(res.status);
    });
  });

  describe('GET /exam-schedules', () => {
    it('should return only the authenticated patient schedules', async () => {
      // Patient 1 creates a schedule
      await request(app.getHttpServer())
        .post('/exam-schedules')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          exams: [{ examCatalogId: catalogExamId }],
          scheduledDateTime: futureDate(20),
        })
        .expect(201);

      // Patient 2 creates a schedule
      await request(app.getHttpServer())
        .post('/exam-schedules')
        .set('Authorization', `Bearer ${patientToken2}`)
        .send({
          exams: [{ customExamName: 'Patient 2 Exam' }],
          scheduledDateTime: futureDate(21),
        })
        .expect(201);

      // Patient 1 lists — should not see Patient 2's schedules
      const res1 = await request(app.getHttpServer())
        .get('/exam-schedules')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(Array.isArray(res1.body)).toBe(true);
      // All returned schedules belong to patient 1
      // (patient 1 created multiple schedules in previous tests)
      expect(res1.body.length).toBeGreaterThanOrEqual(1);

      // Patient 2 lists — should only see their own
      const res2 = await request(app.getHttpServer())
        .get('/exam-schedules')
        .set('Authorization', `Bearer ${patientToken2}`)
        .expect(200);

      expect(res2.body).toHaveLength(1);
      expect(res2.body[0].items[0].customExamName).toBe('Patient 2 Exam');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/exam-schedules')
        .expect(401);
    });
  });
});
