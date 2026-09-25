import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Appointment } from '../entities/appointment.entity';
import { Medication } from '../entities/medication.entity';
import { Exam } from '../entities/exam.entity';
import { PatientAccessLog } from '../entities/patient-access-log.entity';
import { PatientDisease } from '../entities/patient-disease.entity';
import { PatientAllergy } from '../entities/patient-allergy.entity';
import { PatientVaccine } from '../entities/patient-vaccine.entity';
import { PatientSurgery } from '../entities/patient-surgery.entity';
import { Dependent } from '../entities/dependent.entity';
import { FinancialConvenio } from '../entities/financial-convenio.entity';
import { Certificate } from '../entities/certificate.entity';
import { Clinic } from '../entities/clinic.entity';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Unit tests for the surgery sub-resource: validation rules, authorization
 * (patient can only touch their own record), the diagnosis-belongs-to-patient
 * rule, and status transitions. Repositories are mocked so the tests focus on
 * the service logic (mirrors how an invalid payload is rejected at the API).
 */
describe('PatientsService - Surgeries', () => {
  let service: PatientsService;
  let surgeryRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let diseaseRepo: { findOne: jest.Mock };
  let accessLogRepo: { create: jest.Mock; save: jest.Mock };

  const PATIENT_ID = 'patient-1';
  const OTHER_PATIENT_ID = 'patient-2';

  // A patient acting on their own record.
  const asPatient = {
    userId: PATIENT_ID,
    userType: 'patient',
    role: null as string | null,
    activeClinicId: null as string | null,
  };

  function repoMock(extra: Record<string, jest.Mock> = {}) {
    return {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'new-id', ...x })),
      remove: jest.fn(() => Promise.resolve()),
      createQueryBuilder: jest.fn(),
      ...extra,
    };
  }

  beforeEach(async () => {
    const patientRepo = repoMock();
    // findOne on the service resolves the patient for authorization. Default:
    // the requested patient exists and is the same as the caller.
    patientRepo.findOne.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, name: 'Test', type: 'patient' }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(DoctorPermission), useValue: repoMock() },
        { provide: getRepositoryToken(ClinicMembership), useValue: repoMock() },
        { provide: getRepositoryToken(Appointment), useValue: repoMock() },
        { provide: getRepositoryToken(Medication), useValue: repoMock() },
        { provide: getRepositoryToken(Exam), useValue: repoMock() },
        { provide: getRepositoryToken(PatientAccessLog), useValue: repoMock() },
        { provide: getRepositoryToken(PatientDisease), useValue: repoMock() },
        { provide: getRepositoryToken(PatientAllergy), useValue: repoMock() },
        { provide: getRepositoryToken(PatientVaccine), useValue: repoMock() },
        { provide: getRepositoryToken(PatientSurgery), useValue: repoMock() },
        { provide: getRepositoryToken(Dependent), useValue: repoMock() },
        { provide: getRepositoryToken(FinancialConvenio), useValue: repoMock() },
        { provide: getRepositoryToken(Certificate), useValue: repoMock() },
        { provide: getRepositoryToken(Clinic), useValue: repoMock() },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = module.get(PatientsService);
    surgeryRepo = module.get(getRepositoryToken(PatientSurgery));
    diseaseRepo = module.get(getRepositoryToken(PatientDisease));
    accessLogRepo = module.get(getRepositoryToken(PatientAccessLog));
  });

  const create = (data: any) =>
    service.createSurgery(
      PATIENT_ID,
      asPatient.userId,
      asPatient.userType,
      asPatient.role as string,
      asPatient.activeClinicId as string,
      data,
    );

  // ── Creation ──
  describe('create', () => {
    it('creates a performed surgery', async () => {
      const result = await create({
        name: 'Hernioplastia inguinal',
        status: 'PERFORMED',
        date: '2024-05-12',
        outcome: 'Sem complicações',
      });
      expect(surgeryRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('creates a planned surgery', async () => {
      await create({ name: 'Colecistectomia', status: 'PLANNED', date: '2030-01-10' });
      expect(surgeryRepo.save).toHaveBeenCalled();
    });

    it('creates a cancelled surgery', async () => {
      await create({ name: 'Artroscopia', status: 'CANCELLED' });
      expect(surgeryRepo.save).toHaveBeenCalled();
    });

    it('logs access on create', async () => {
      await create({ name: 'Cirurgia X', status: 'PLANNED' });
      expect(accessLogRepo.save).toHaveBeenCalled();
    });
  });

  // ── Validation ──
  describe('validation', () => {
    it('rejects empty name', async () => {
      await expect(create({ name: '   ', status: 'PLANNED' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an invalid status enum', async () => {
      await expect(create({ name: 'X', status: 'DONE' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an invalid laterality enum', async () => {
      await expect(
        create({ name: 'X', status: 'PLANNED', laterality: 'MIDDLE' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid date', async () => {
      await expect(
        create({ name: 'X', status: 'PLANNED', date: 'not-a-date' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects discharge date earlier than surgery date', async () => {
      await expect(
        create({
          name: 'X',
          status: 'PERFORMED',
          date: '2024-05-12',
          dischargeDate: '2024-05-10',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts discharge date equal/after surgery date', async () => {
      await create({
        name: 'X',
        status: 'PERFORMED',
        date: '2024-05-12',
        dischargeDate: '2024-05-14',
      });
      expect(surgeryRepo.save).toHaveBeenCalled();
    });

    it('rejects post-op info on a planned surgery', async () => {
      await expect(create({ name: 'X', status: 'PLANNED', outcome: 'ok' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects implant details without hasPermanentImplant', async () => {
      await expect(
        create({ name: 'X', status: 'PLANNED', implantType: 'Prótese' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts implant details when hasPermanentImplant is true', async () => {
      await create({
        name: 'X',
        status: 'PLANNED',
        hasPermanentImplant: true,
        implantType: 'Tela',
      });
      expect(surgeryRepo.save).toHaveBeenCalled();
    });
  });

  // ── Diagnosis relationship ──
  describe('diagnosis relationship', () => {
    it('accepts a diagnosis that belongs to the patient', async () => {
      diseaseRepo.findOne.mockResolvedValue({ id: 'd1', patientId: PATIENT_ID });
      await create({ name: 'X', status: 'PLANNED', diagnosisId: 'd1' });
      expect(diseaseRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'd1', patientId: PATIENT_ID },
      });
      expect(surgeryRepo.save).toHaveBeenCalled();
    });

    it('rejects a diagnosis that does not belong to the patient', async () => {
      // Repo scoped by patientId returns nothing for a foreign diagnosis.
      diseaseRepo.findOne.mockResolvedValue(null);
      await expect(
        create({ name: 'X', status: 'PLANNED', diagnosisId: 'foreign-d' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ── Authorization / isolation ──
  describe('authorization', () => {
    it('forbids a patient from accessing another patient surgeries', async () => {
      await expect(
        service.getSurgeries(OTHER_PATIENT_ID, PATIENT_ID, 'patient', null as any, null as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('forbids a patient from creating a surgery for another patient', async () => {
      await expect(
        service.createSurgery(OTHER_PATIENT_ID, PATIENT_ID, 'patient', null as any, null as any, {
          name: 'X',
          status: 'PLANNED',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── Update ──
  describe('update', () => {
    it('updates status from PLANNED to PERFORMED', async () => {
      surgeryRepo.findOne.mockResolvedValue({
        id: 's1',
        patientId: PATIENT_ID,
        status: 'PLANNED',
        date: new Date('2024-05-12'),
      });
      await service.updateSurgery(
        PATIENT_ID,
        's1',
        PATIENT_ID,
        'patient',
        null as any,
        null as any,
        { status: 'PERFORMED', outcome: 'Sem complicações' },
      );
      expect(surgeryRepo.save).toHaveBeenCalled();
    });

    it('rejects discharge before existing surgery date on partial update', async () => {
      surgeryRepo.findOne.mockResolvedValue({
        id: 's1',
        patientId: PATIENT_ID,
        status: 'PERFORMED',
        date: new Date('2024-05-12'),
      });
      await expect(
        service.updateSurgery(PATIENT_ID, 's1', PATIENT_ID, 'patient', null as any, null as any, {
          dischargeDate: '2024-05-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
