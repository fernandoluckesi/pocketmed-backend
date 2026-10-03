import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Report, ReportType } from '../entities/report.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Dependent } from '../entities/dependent.entity';
import { Appointment } from '../entities/appointment.entity';
import { DoctorsService } from '../doctors/doctors.service';
import { UploadService } from '../upload/upload.service';
import { DocumentGenerationService } from '../documents/document-generation.service';
import { SignatureService } from '../documents/signature/signature.service';
import { AuditService } from '../audit/audit.service';
import { DocumentStatus } from '../documents/document.types';
import { SignatureStatus } from '../documents/signature/signature.types';

/**
 * Covers the two things a laudo must get right regardless of UI: only the
 * issuing doctor can manage one, and a signed one is immutable. Also pins
 * down that generating a PDF through the current (mock) signature provider
 * never leaves the document marked as signed.
 */
describe('ReportsService - access control & immutability', () => {
  let service: ReportsService;
  let reportRepo: { findOne: jest.Mock; save: jest.Mock; remove: jest.Mock };
  let docGen: { renderToBuffer: jest.Mock; computeHash: jest.Mock; store: jest.Mock };
  let signature: { signDocument: jest.Mock };
  let doctorsService: { hasPermission: jest.Mock };
  let uploadService: {
    isAvailable: boolean;
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
  };

  const DOCTOR_ID = 'doctor-owner';
  const OTHER_DOCTOR_ID = 'doctor-other';
  const REPORT_ID = 'report-1';

  function buildReport(overrides: Partial<Report> = {}): Report {
    return {
      id: REPORT_ID,
      doctorId: DOCTOR_ID,
      patientId: 'patient-1',
      dependentId: null,
      appointmentId: null,
      reportType: ReportType.LAUDO_MEDICO,
      reportTypeOther: null,
      issueDate: new Date('2026-03-15'),
      relatedServiceDate: null,
      purpose: null,
      title: 'Laudo de acompanhamento',
      doctorNameSnapshot: 'Dra. Ana',
      doctorCrmSnapshot: '100001/SP',
      doctorSpecialtySnapshot: 'Cardiologia',
      patientNameSnapshot: 'João da Silva',
      patientCpfSnapshot: null,
      patientBirthDateSnapshot: null,
      patientGenderSnapshot: null,
      chiefComplaint: null,
      clinicalHistory: null,
      physicalExam: null,
      complementaryExams: null,
      results: null,
      diagnosis: null,
      conclusion: { type: 'doc', content: [] },
      recommendations: null,
      observations: null,
      status: DocumentStatus.DRAFT,
      documentUrl: null,
      fileUrl: null,
      documentHash: null,
      documentType: 'report',
      signatureStatus: SignatureStatus.NONE,
      signatureProvider: null,
      signedAt: null,
      externalSignatureId: null,
      supersedesReportId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as Report;
  }

  beforeEach(async () => {
    reportRepo = {
      findOne: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
      remove: jest.fn(),
    };
    docGen = {
      renderToBuffer: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7')),
      computeHash: jest.fn().mockReturnValue('c'.repeat(64)),
      store: jest.fn().mockResolvedValue('https://files.example/reports/report-1.pdf'),
    };
    signature = {
      // Matches the current MockSignatureProvider's behaviour.
      signDocument: jest.fn().mockResolvedValue({
        status: SignatureStatus.NONE,
        provider: 'mock',
        pdfBuffer: Buffer.from('%PDF-1.7'),
        externalSignatureId: null,
        signedAt: null,
      }),
    };
    doctorsService = { hasPermission: jest.fn().mockResolvedValue(false) };
    uploadService = {
      isAvailable: true,
      uploadFile: jest.fn().mockResolvedValue('https://files.example/medical-documents/laudo.pdf'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Report), useValue: reportRepo },
        { provide: getRepositoryToken(Doctor), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Patient), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Dependent), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Appointment), useValue: { findOne: jest.fn() } },
        { provide: DoctorsService, useValue: doctorsService },
        { provide: UploadService, useValue: uploadService },
        { provide: DocumentGenerationService, useValue: docGen },
        { provide: SignatureService, useValue: signature },
        {
          provide: AuditService,
          useValue: {
            recordCreate: jest.fn(),
            recordRead: jest.fn(),
            recordUpdate: jest.fn(),
            recordDelete: jest.fn(),
            recordAccessDenied: jest.fn(),
            recordSecurityEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('findOne', () => {
    it('rejects a doctor with no permission over the patient', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport());
      await expect(service.findOne(REPORT_ID, OTHER_DOCTOR_ID)).rejects.toThrow(ForbiddenException);
    });

    it('allows the issuing doctor', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport());
      await expect(service.findOne(REPORT_ID, DOCTOR_ID)).resolves.toMatchObject({
        id: REPORT_ID,
      });
    });

    it('404s when the report does not exist', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(REPORT_ID, DOCTOR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('immutability once signed', () => {
    beforeEach(() => {
      reportRepo.findOne.mockResolvedValue(
        buildReport({ status: DocumentStatus.SIGNED, signatureStatus: SignatureStatus.SIGNED }),
      );
    });

    it('refuses to update', async () => {
      await expect(service.update(REPORT_ID, DOCTOR_ID, { title: 'Outro título' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('refuses to delete', async () => {
      await expect(service.delete(REPORT_ID, DOCTOR_ID)).rejects.toThrow(ConflictException);
    });

    it('refuses to regenerate the PDF', async () => {
      await expect(service.generatePdf(REPORT_ID, DOCTOR_ID)).rejects.toThrow(ConflictException);
    });

    it('refuses to cancel', async () => {
      await expect(service.cancel(REPORT_ID, DOCTOR_ID)).rejects.toThrow(ConflictException);
    });
  });

  describe('management is restricted to the issuing doctor', () => {
    it('refuses an update from another doctor even with patient access', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport());
      doctorsService.hasPermission.mockResolvedValue(true);

      await expect(
        service.update(REPORT_ID, OTHER_DOCTOR_ID, { title: 'Alterado' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('generatePdf', () => {
    it('stores the PDF and marks the report GENERATED, never SIGNED', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport());

      const saved = await service.generatePdf(REPORT_ID, DOCTOR_ID);

      expect(docGen.store).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ folder: 'reports' }),
      );
      expect(saved.status).toBe(DocumentStatus.GENERATED);
      expect(saved.signatureStatus).toBe(SignatureStatus.NONE);
      expect(saved.signedAt).toBeNull();
      expect(saved.documentHash).toBe('c'.repeat(64));
    });

    it('passes the document through the signature abstraction', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport());

      await service.generatePdf(REPORT_ID, DOCTOR_ID);

      expect(signature.signDocument).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: REPORT_ID, signerName: 'Dra. Ana' }),
      );
    });
  });

  describe('attachFile', () => {
    const file = {
      originalname: 'laudo-2019.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7'),
      size: 8,
    } as Express.Multer.File;

    it('stores an uploaded document in fileUrl, not documentUrl', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport());

      const saved = await service.attachFile(REPORT_ID, DOCTOR_ID, file);

      expect(uploadService.uploadFile).toHaveBeenCalledWith(file, 'medical-documents');
      expect(saved.fileUrl).toBe('https://files.example/medical-documents/laudo.pdf');
      // An upload is not something Hispora generated — it must never be
      // presented as the platform's own generated document.
      expect(saved.documentUrl).toBeNull();
      expect(saved.documentHash).toBeNull();
      expect(saved.signatureStatus).toBe(SignatureStatus.NONE);
    });

    it('deletes the superseded attachment when replacing one', async () => {
      reportRepo.findOne.mockResolvedValue(
        buildReport({ fileUrl: 'https://files.example/medical-documents/old.pdf' }),
      );

      await service.attachFile(REPORT_ID, DOCTOR_ID, file);

      expect(uploadService.deleteFile).toHaveBeenCalledWith(
        'https://files.example/medical-documents/old.pdf',
      );
    });

    it('refuses to attach to a signed report', async () => {
      reportRepo.findOne.mockResolvedValue(
        buildReport({ status: DocumentStatus.SIGNED, signatureStatus: SignatureStatus.SIGNED }),
      );

      await expect(service.attachFile(REPORT_ID, DOCTOR_ID, file)).rejects.toThrow(
        ConflictException,
      );
    });

    it('refuses an attachment from another doctor', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport());
      doctorsService.hasPermission.mockResolvedValue(true);

      await expect(service.attachFile(REPORT_ID, OTHER_DOCTOR_ID, file)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('fails loudly when storage is unavailable instead of saving an empty url', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport());
      uploadService.isAvailable = false;

      await expect(service.attachFile(REPORT_ID, DOCTOR_ID, file)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(reportRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('removeFile', () => {
    it('clears the attachment and deletes the stored object', async () => {
      reportRepo.findOne.mockResolvedValue(
        buildReport({ fileUrl: 'https://files.example/medical-documents/old.pdf' }),
      );

      const saved = await service.removeFile(REPORT_ID, DOCTOR_ID);

      expect(saved.fileUrl).toBeNull();
      expect(uploadService.deleteFile).toHaveBeenCalledWith(
        'https://files.example/medical-documents/old.pdf',
      );
    });

    it('404s when there is nothing attached', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport());
      await expect(service.removeFile(REPORT_ID, DOCTOR_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('moves a generated report to CANCELED without deleting it', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport({ status: DocumentStatus.GENERATED }));

      const saved = await service.cancel(REPORT_ID, DOCTOR_ID);

      expect(saved.status).toBe(DocumentStatus.CANCELED);
      expect(reportRepo.remove).not.toHaveBeenCalled();
    });

    it('refuses to cancel twice', async () => {
      reportRepo.findOne.mockResolvedValue(buildReport({ status: DocumentStatus.CANCELED }));
      await expect(service.cancel(REPORT_ID, DOCTOR_ID)).rejects.toThrow(ConflictException);
    });
  });
});
