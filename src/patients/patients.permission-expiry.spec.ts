import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PatientsService } from './patients.service';
import { Patient } from '../entities/patient.entity';
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
import { Report } from '../entities/report.entity';
import { MedicalAttachment } from '../entities/medical-attachment.entity';
import { Clinic } from '../entities/clinic.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UploadService } from '../upload/upload.service';
import { DocumentTextExtractorService } from '../document-parsing/document-text-extractor.service';
import { EmailService } from '../email/email.service';
import { ConsultationSummaryEmailService } from './consultation-summary-email.service';

/**
 * `PatientsService.findOne` is the single checkpoint every patient
 * sub-resource route calls first (consultations, exams, medications,
 * diseases, allergies, vaccines, surgeries, reports, attachments — see
 * patients.controller.ts). This proves it actually enforces
 * `DoctorPermission.expiresAt` — the one change that makes the
 * cross-clinic consent flow's 2-hour window apply everywhere, without a
 * new guard/interceptor on every one of those routes.
 */
describe('PatientsService.findOne — permission expiry (item: cross-clinic access)', () => {
  let service: PatientsService;
  let patientRepo: { findOne: jest.Mock };
  let permissionRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    patientRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'patient-1',
        name: 'Ana Maria',
        doctorCreatorId: 'other-doctor',
      }),
    };
    permissionRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(DoctorPermission), useValue: permissionRepo },
        { provide: getRepositoryToken(ClinicMembership), useValue: {} },
        { provide: getRepositoryToken(Appointment), useValue: {} },
        { provide: getRepositoryToken(Medication), useValue: {} },
        { provide: getRepositoryToken(Exam), useValue: {} },
        { provide: getRepositoryToken(PatientAccessLog), useValue: {} },
        { provide: getRepositoryToken(PatientDisease), useValue: {} },
        { provide: getRepositoryToken(PatientAllergy), useValue: {} },
        { provide: getRepositoryToken(PatientVaccine), useValue: {} },
        { provide: getRepositoryToken(PatientSurgery), useValue: {} },
        { provide: getRepositoryToken(Dependent), useValue: {} },
        { provide: getRepositoryToken(FinancialConvenio), useValue: {} },
        { provide: getRepositoryToken(Certificate), useValue: {} },
        { provide: getRepositoryToken(Report), useValue: {} },
        { provide: getRepositoryToken(MedicalAttachment), useValue: {} },
        { provide: getRepositoryToken(Clinic), useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: UploadService, useValue: {} },
        { provide: DocumentTextExtractorService, useValue: {} },
        { provide: EmailService, useValue: {} },
        { provide: ConsultationSummaryEmailService, useValue: {} },
      ],
    }).compile();

    service = module.get(PatientsService);
  });

  it('grants access through a permission with no expiry (the pre-existing permanent-grant case)', async () => {
    permissionRepo.findOne.mockResolvedValue({ id: 'perm-1', isActive: true, expiresAt: null });

    const result: any = await service.findOne('patient-1', 'doctor-2', 'doctor', 'doctor', null);
    expect(result.hasPermission).toBe(true);
  });

  it('grants access through a permission that has not expired yet', async () => {
    permissionRepo.findOne.mockResolvedValue({
      id: 'perm-1',
      isActive: true,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });

    const result: any = await service.findOne('patient-1', 'doctor-2', 'doctor', 'doctor', null);
    expect(result.hasPermission).toBe(true);
  });

  it('denies access once the cross-clinic grant has expired, even though isActive is still true', async () => {
    // isActive stays true — nothing flips it off on expiry, the expiry check
    // IS the enforcement. Mirrors a real expired row: nobody updates
    // isActive=false when the 2h window elapses, findOne's query itself
    // must stop matching it.
    permissionRepo.findOne.mockResolvedValue(null); // what the real expiry-aware query returns

    await expect(
      service.findOne('patient-1', 'doctor-2', 'doctor', 'doctor', null),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still grants access unconditionally to the doctor who created the patient record', async () => {
    patientRepo.findOne.mockResolvedValue({
      id: 'patient-1',
      name: 'Ana Maria',
      doctorCreatorId: 'doctor-2',
    });
    permissionRepo.findOne.mockResolvedValue(null);

    const result: any = await service.findOne('patient-1', 'doctor-2', 'doctor', 'doctor', null);
    expect(result.hasPermission).toBe(true);
  });
});
