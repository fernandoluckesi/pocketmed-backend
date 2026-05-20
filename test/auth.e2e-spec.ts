import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, registerPatient, registerDoctor, loginUser } from './test-utils';

describe('Auth Module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register/patient', () => {
    it('should register a patient successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register/patient')
        .send({
          name: 'Maria Silva',
          email: 'maria.silva@test.com',
          password: 'senha123',
          gender: 'Feminino',
          phone: '(11) 98765-4321',
          birthDate: '1995-03-10',
        })
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.name).toBe('Maria Silva');
      expect(res.body.user.email).toBe('maria.silva@test.com');
      expect(res.body.user.type).toBe('patient');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should return 409 for duplicate email', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/auth/register/patient')
        .send({
          name: 'Duplicate User',
          email: 'duplicate@test.com',
          password: 'senha123',
          gender: 'Masculino',
          phone: '(11) 99999-0001',
          birthDate: '1990-01-01',
        })
        .expect(201);

      // Second registration with same email
      const res = await request(app.getHttpServer())
        .post('/auth/register/patient')
        .send({
          name: 'Another User',
          email: 'duplicate@test.com',
          password: 'senha456',
          gender: 'Feminino',
          phone: '(11) 99999-0002',
          birthDate: '1992-02-02',
        })
        .expect(409);

      expect(res.body.message).toContain('already registered');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register/patient')
        .send({
          name: 'Incomplete User',
          // missing email, password, gender, phone, birthDate
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should return 400 for short password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register/patient')
        .send({
          name: 'Short Pass',
          email: 'shortpass@test.com',
          password: '123', // less than 6 chars
          gender: 'Masculino',
          phone: '(11) 99999-0003',
          birthDate: '1990-01-01',
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });

  describe('POST /auth/register/doctor', () => {
    it('should register a doctor successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register/doctor')
        .send({
          name: 'Dr. Carlos Souza',
          email: 'dr.carlos@test.com',
          password: 'senha123',
          gender: 'Masculino',
          specialty: 'Cardiologia',
          cpf: '12345678901',
          phone: '(11) 98765-0000',
          birthDate: '1980-07-15',
          crm: '123456/SP',
        })
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.name).toBe('Dr. Carlos Souza');
      expect(res.body.user.type).toBe('doctor');
      expect(res.body.user.specialty).toBe('Cardiologia');
      expect(res.body.user.crm).toBe('123456/SP');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should return 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register/doctor')
        .send({
          name: 'Dr. First',
          email: 'dr.dup@test.com',
          password: 'senha123',
          gender: 'Masculino',
          specialty: 'Neurologia',
          cpf: '98765432100',
          phone: '(11) 98765-1111',
          birthDate: '1982-03-20',
          crm: '654321/RJ',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/register/doctor')
        .send({
          name: 'Dr. Second',
          email: 'dr.dup@test.com',
          password: 'senha456',
          gender: 'Feminino',
          specialty: 'Pediatria',
          cpf: '11122233344',
          phone: '(11) 98765-2222',
          birthDate: '1985-06-10',
          crm: '111222/MG',
        })
        .expect(409);

      expect(res.body.message).toContain('already registered');
    });
  });

  describe('POST /auth/login', () => {
    const testEmail = 'login.test@test.com';
    const testPassword = 'mypassword123';

    beforeAll(async () => {
      await registerPatient(app, { email: testEmail, password: testPassword });
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testEmail);
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testEmail, password: 'wrongpassword' })
        .expect(401);

      expect(res.body.message).toContain('Invalid credentials');
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'anypassword' })
        .expect(401);

      expect(res.body.message).toContain('Invalid credentials');
    });
  });

  describe('POST /auth/change-password', () => {
    const email = 'changepass@test.com';
    const oldPassword = 'oldpassword123';
    const newPassword = 'newpassword456';
    let token: string;

    beforeAll(async () => {
      const result = await registerPatient(app, { email, password: oldPassword });
      token = result.token;
    });

    it('should change password successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword, newPassword })
        .expect(200);

      expect(res.body.message).toContain('Password changed successfully');

      // Verify new password works
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: newPassword })
        .expect(200);

      expect(loginRes.body).toHaveProperty('token');
    });

    it('should return 400 for wrong old password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'totallyWrong', newPassword: 'doesntmatter' })
        .expect(400);

      expect(res.body.message).toContain('Invalid old password');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .send({ oldPassword: 'any', newPassword: 'any123' })
        .expect(401);
    });
  });
});
