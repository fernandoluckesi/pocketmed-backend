import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  createTestApp,
  registerPatient,
  registerDoctor,
  futureDate,
} from './test-utils';

describe('Appointments Module (e2e)', () => {
  let app: INestApplication;
  let patientToken: string;
  let patientToken2: string;
  let patientId: string;
  let doctorToken: string;
  let doctorId: string;
  let doctorCrm: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Register patient 1
    const patient1 = await registerPatient(app, {
      email: 'appt-patient1@test.com',
      name: 'Patient One',
    });
    patientToken = patient1.token;
    patientId = patient1.user.id;

    // Register patient 2
    const patient2 = await registerPatient(app, {
      email: 'appt-patient2@test.com',
      name: 'Patient Two',
    });
    patientToken2 = patient2.token;

    // Register doctor
    const doctor = await registerDoctor(app, {
      email: 'appt-doctor@test.com',
      name: 'Dr. Appointment',
      crm: '999888/SP',
    });
    doctorToken = doctor.token;
    doctorId = doctor.user.id;
    doctorCrm = doctor.user.crm;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /appointments', () => {
    it('should allow patient to create appointment with registered doctor', async () => {
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId,
          reason: 'Consulta de rotina',
          dateTime: futureDate(5),
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.doctorId).toBe(doctorId);
      expect(res.body.reason).toBe('Consulta de rotina');
      expect(res.body.status).toBe('approved'); // Patient-created = auto-approved
    });

    it('should allow patient to create appointment with external doctor (by CRM)', async () => {
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorCrm: '000111/RJ',
          doctorName: 'Dr. Externo',
          doctorSpecialty: 'Dermatologia',
          reason: 'Consulta dermatológica',
          dateTime: futureDate(10),
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.doctorId).toBeNull();
      expect(res.body.doctorCrm).toBe('000111/RJ');
      expect(res.body.doctorName).toBe('Dr. Externo');
      expect(res.body.status).toBe('approved');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/appointments')
        .send({
          doctorId,
          reason: 'Test',
          dateTime: futureDate(5),
        })
        .expect(401);
    });

    it('should allow doctor to create appointment for patient', async () => {
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          reason: 'Retorno cardiológico',
          dateTime: futureDate(3),
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.patientId).toBe(patientId);
      expect(res.body.status).toBe('pending'); // Doctor-created = pending
    });

    it('should return 400 when doctor creates without patientId or dependentId', async () => {
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          reason: 'Missing patient',
          dateTime: futureDate(5),
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });

  describe('PUT /appointments/:id (finalization)', () => {
    let patientAppointmentId: string;
    let doctorAppointmentId: string;

    beforeAll(async () => {
      // Patient creates an appointment (auto-approved)
      const patientRes = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId,
          reason: 'Appointment for finalization test',
          dateTime: futureDate(15),
        })
        .expect(201);
      patientAppointmentId = patientRes.body.id;

      // Doctor creates an appointment for patient (pending)
      const doctorRes = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          reason: 'Doctor appointment for finalization test',
          dateTime: futureDate(16),
        })
        .expect(201);
      doctorAppointmentId = doctorRes.body.id;
    });

    it('should allow patient to finalize own appointment (auto-approved)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/appointments/${patientAppointmentId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ isCompleted: true })
        .expect(200);

      expect(res.body.isCompleted).toBe(true);
      expect(res.body.status).toBe('completed');
    });

    it('should set doctor finalization to pending (requires patient approval)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/appointments/${doctorAppointmentId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          isCompleted: true,
          doctorFeedback: 'Paciente está bem',
          doctorInstructions: 'Continuar medicação',
        })
        .expect(200);

      // Doctor finalization sets status to pending, isCompleted stays false
      expect(res.body.isCompleted).toBe(false);
      expect(res.body.status).toBe('pending');
    });
  });

  describe('GET /appointments', () => {
    it('should return only the authenticated patient appointments', async () => {
      // Patient 2 creates an appointment
      await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${patientToken2}`)
        .send({
          doctorCrm: '555666/MG',
          doctorName: 'Dr. Other',
          doctorSpecialty: 'Ortopedia',
          reason: 'Patient 2 appointment',
          dateTime: futureDate(8),
        })
        .expect(201);

      // Patient 1 lists
      const res1 = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(Array.isArray(res1.body)).toBe(true);
      // Patient 1 should not see Patient 2's appointments
      const patient2Appointments = res1.body.filter(
        (a: any) => a.reason === 'Patient 2 appointment',
      );
      expect(patient2Appointments).toHaveLength(0);

      // Patient 2 lists
      const res2 = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', `Bearer ${patientToken2}`)
        .expect(200);

      expect(res2.body.length).toBeGreaterThanOrEqual(1);
      expect(res2.body.some((a: any) => a.reason === 'Patient 2 appointment')).toBe(true);
    });

    it('should return doctor appointments when authenticated as doctor', async () => {
      const res = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // Doctor should see appointments where they are the doctor
      res.body.forEach((a: any) => {
        expect(a.doctorId).toBe(doctorId);
      });
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/appointments')
        .expect(401);
    });
  });

  describe('POST /appointments/:id/respond', () => {
    let pendingAppointmentId: string;

    beforeAll(async () => {
      // Doctor creates appointment for patient
      const res = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId,
          reason: 'Appointment for respond test',
          dateTime: futureDate(25),
        })
        .expect(201);

      pendingAppointmentId = res.body.id;

      // Doctor finalizes it (sets to pending with feedback)
      await request(app.getHttpServer())
        .put(`/appointments/${pendingAppointmentId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          isCompleted: true,
          doctorFeedback: 'Feedback for respond test',
          doctorInstructions: 'Instructions for respond test',
        })
        .expect(200);
    });

    it('should allow patient to approve doctor finalization', async () => {
      const res = await request(app.getHttpServer())
        .post(`/appointments/${pendingAppointmentId}/respond`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ status: 'completed' })
        .expect(201);

      expect(res.body.appointment.status).toBe('completed');
      expect(res.body.appointment.isCompleted).toBe(true);
    });
  });
});
