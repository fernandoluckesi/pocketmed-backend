import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DependentsService } from './dependents.service';
import { Dependent } from '../entities/dependent.entity';
import { Patient } from '../entities/patient.entity';
import { DependentResponsibleInvite } from '../entities/dependent-responsible-invite.entity';
import { UploadService } from '../upload/upload.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Unit tests for the account-deletion support methods on DependentsService:
 * getDeletionImpact (what happens to admin'd dependents) and transferAdmin
 * (direct transfer of administration to an already-linked responsible, no
 * invite/acceptance). Repositories are mocked to focus on the service logic.
 */
describe('DependentsService - admin transfer & deletion impact', () => {
  let service: DependentsService;
  let dependentRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let inviteRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let patientRepo: { findOne: jest.Mock };

  const ADMIN_ID = 'patient-admin';
  const OTHER_RESP_ID = 'patient-other';
  const STRANGER_ID = 'patient-stranger';

  beforeEach(async () => {
    dependentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
    };
    inviteRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((x) => Promise.resolve({ id: 'invite-1', ...x })),
      create: jest.fn((x) => x),
      update: jest.fn(),
    };
    patientRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependentsService,
        { provide: getRepositoryToken(Dependent), useValue: dependentRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        {
          provide: getRepositoryToken(DependentResponsibleInvite),
          useValue: inviteRepo,
        },
        { provide: UploadService, useValue: { uploadFile: jest.fn(), deleteFile: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: {
            createNotification: jest.fn().mockResolvedValue(undefined),
            syncNotificationStatusByType: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<DependentsService>(DependentsService);
  });

  describe('getDeletionImpact', () => {
    it('reports no admin dependents when the user administers none', async () => {
      dependentRepo.find.mockResolvedValue([]);
      const result = await service.getDeletionImpact(ADMIN_ID);
      expect(result.hasAdminDependents).toBe(false);
      expect(result.dependents).toEqual([]);
    });

    it('lists other responsibles (excluding the leaving admin) for each dependent', async () => {
      dependentRepo.find.mockResolvedValue([
        {
          id: 'dep-1',
          name: 'Filho',
          profileImage: null,
          responsibles: [
            { id: ADMIN_ID, name: 'Admin', profileImage: null },
            { id: OTHER_RESP_ID, name: 'Outro', profileImage: null },
          ],
        },
        {
          id: 'dep-2',
          name: 'Pai',
          profileImage: null,
          responsibles: [{ id: ADMIN_ID, name: 'Admin', profileImage: null }],
        },
      ]);

      const result = await service.getDeletionImpact(ADMIN_ID);

      expect(result.hasAdminDependents).toBe(true);
      const dep1 = result.dependents.find((d) => d.id === 'dep-1')!;
      expect(dep1.hasOtherResponsibles).toBe(true);
      expect(dep1.otherResponsibles).toEqual([
        { id: OTHER_RESP_ID, name: 'Outro', profileImage: null },
      ]);

      const dep2 = result.dependents.find((d) => d.id === 'dep-2')!;
      expect(dep2.hasOtherResponsibles).toBe(false);
      expect(dep2.otherResponsibles).toEqual([]);
    });
  });

  describe('transferAdmin', () => {
    it('transfers administration to an existing responsible', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      const result = await service.transferAdmin('dep-1', OTHER_RESP_ID, ADMIN_ID);

      expect(result.adminResponsibleId).toBe(OTHER_RESP_ID);
      expect(dependentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ adminResponsibleId: OTHER_RESP_ID }),
      );
    });

    it('rejects when the requester is not the current admin', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await expect(
        service.transferAdmin('dep-1', OTHER_RESP_ID, OTHER_RESP_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(dependentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects when the target is not already a responsible', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await expect(service.transferAdmin('dep-1', STRANGER_ID, ADMIN_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dependentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects transferring to yourself', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await expect(service.transferAdmin('dep-1', ADMIN_ID, ADMIN_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when the dependent does not exist', async () => {
      dependentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.transferAdmin('missing', OTHER_RESP_ID, ADMIN_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('leaveResponsible', () => {
    it('removes a non-admin responsible and rejects their pending invites', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await service.leaveResponsible('dep-1', OTHER_RESP_ID);

      // The leaving user is dropped from responsibles.
      expect(dependentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          responsibles: [{ id: ADMIN_ID }],
        }),
      );
      expect(inviteRepo.update).toHaveBeenCalled();
    });

    it('blocks the admin from leaving directly', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await expect(service.leaveResponsible('dep-1', ADMIN_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dependentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects when the user is not a responsible', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }],
      });

      await expect(service.leaveResponsible('dep-1', STRANGER_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('requestAdminTransfer', () => {
    it('creates a pending admin_transfer invite for an existing responsible', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        name: 'Filho',
        adminResponsibleId: ADMIN_ID,
        responsibles: [
          { id: ADMIN_ID, email: 'admin@x.com' },
          { id: OTHER_RESP_ID, email: 'other@x.com' },
        ],
      });
      inviteRepo.findOne.mockResolvedValue(null); // no pending
      patientRepo.findOne.mockResolvedValue({ id: ADMIN_ID, name: 'Admin' });

      const result = await service.requestAdminTransfer('dep-1', OTHER_RESP_ID, ADMIN_ID);

      expect(inviteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteePatientId: OTHER_RESP_ID,
          kind: 'admin_transfer',
          status: 'pending',
        }),
      );
      expect(result.message).toMatch(/sent/i);
    });

    it('rejects when the requester is not the admin', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await expect(
        service.requestAdminTransfer('dep-1', OTHER_RESP_ID, OTHER_RESP_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when the target is not already a responsible', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }],
      });

      await expect(
        service.requestAdminTransfer('dep-1', STRANGER_ID, ADMIN_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate pending admin transfer', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID, email: 'o@x.com' }],
      });
      inviteRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.requestAdminTransfer('dep-1', OTHER_RESP_ID, ADMIN_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
