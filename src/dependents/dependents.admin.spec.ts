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
 * Unit tests for the multi-admin responsible model on DependentsService:
 * promoting extra admins (requestAdminTransfer), leaving as responsible/admin,
 * deletion impact and direct transfer. Admin membership lives on the
 * `dependent_responsibles.isAdmin` join flag, read via raw query — so the
 * mocked `query` is what drives "who is admin" in these tests.
 */
describe('DependentsService - multi-admin & deletion impact', () => {
  let service: DependentsService;
  let dependentRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    query: jest.Mock;
  };
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

  /**
   * Mocks the raw admin queries used by the service:
   * - getAdminIds: SELECT patientId ... isAdmin = 1
   * - getDeletionImpact: SELECT dependentId ... patientId = ? AND isAdmin = 1
   * Everything else (UPDATE for setAdminFlag) resolves empty.
   */
  function mockAdmins(adminIdsByDependent: Record<string, string[]>) {
    dependentRepo.query.mockImplementation((sql: string, params: any[] = []) => {
      const text = String(sql);
      if (text.includes('SELECT patientId') && text.includes('isAdmin')) {
        const depId = params[0];
        return Promise.resolve(
          (adminIdsByDependent[depId] ?? []).map((patientId) => ({ patientId })),
        );
      }
      if (text.includes('SELECT dependentId') && text.includes('isAdmin')) {
        const userId = params[0];
        const deps = Object.entries(adminIdsByDependent)
          .filter(([, admins]) => admins.includes(userId))
          .map(([dependentId]) => ({ dependentId }));
        return Promise.resolve(deps);
      }
      return Promise.resolve([]);
    });
  }

  beforeEach(async () => {
    dependentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
      update: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
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
      mockAdmins({});
      const result = await service.getDeletionImpact(ADMIN_ID);
      expect(result.hasAdminDependents).toBe(false);
      expect(result.dependents).toEqual([]);
    });

    it('only lists dependents where the user is the SOLE admin', async () => {
      // dep-1: ADMIN is the only admin (needs action). dep-2: ADMIN shares with
      // OTHER (another admin remains, so no action needed).
      mockAdmins({ 'dep-1': [ADMIN_ID], 'dep-2': [ADMIN_ID, OTHER_RESP_ID] });
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
          responsibles: [
            { id: ADMIN_ID, name: 'Admin', profileImage: null },
            { id: OTHER_RESP_ID, name: 'Outro', profileImage: null },
          ],
        },
      ]);

      const result = await service.getDeletionImpact(ADMIN_ID);

      expect(result.hasAdminDependents).toBe(true);
      expect(result.dependents.map((d) => d.id)).toEqual(['dep-1']);
      expect(result.dependents[0].otherResponsibles).toEqual([
        { id: OTHER_RESP_ID, name: 'Outro', profileImage: null },
      ]);
    });
  });

  describe('transferAdmin (legacy direct transfer)', () => {
    it('transfers administration to an existing responsible', async () => {
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      const result = await service.transferAdmin('dep-1', OTHER_RESP_ID, ADMIN_ID);

      expect(result.adminResponsibleId).toBe(OTHER_RESP_ID);
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
      mockAdmins({ 'dep-1': [ADMIN_ID] });
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await service.leaveResponsible('dep-1', OTHER_RESP_ID);

      expect(dependentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ responsibles: [{ id: ADMIN_ID }] }),
      );
      expect(inviteRepo.update).toHaveBeenCalled();
    });

    it('blocks the only admin from leaving', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID] });
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

    it('lets an admin leave when another admin remains', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID, OTHER_RESP_ID] });
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: OTHER_RESP_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await service.leaveResponsible('dep-1', ADMIN_ID);

      expect(dependentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ responsibles: [{ id: OTHER_RESP_ID }] }),
      );
    });

    it('rejects when the user is not a responsible', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID] });
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

  describe('leaveAdmin', () => {
    it('steps down when another admin remains', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID, OTHER_RESP_ID] });
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      const result = await service.leaveAdmin('dep-1', ADMIN_ID);
      expect(result.message).toMatch(/no longer an admin/i);
    });

    it('blocks the only admin from stepping down', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID] });
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await expect(service.leaveAdmin('dep-1', ADMIN_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('requestAdminTransfer (promote another admin)', () => {
    it('creates a pending admin_transfer invite for an existing responsible', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID] });
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        name: 'Filho',
        adminResponsibleId: ADMIN_ID,
        responsibles: [
          { id: ADMIN_ID, email: 'admin@x.com' },
          { id: OTHER_RESP_ID, email: 'other@x.com' },
        ],
      });
      inviteRepo.findOne.mockResolvedValue(null);
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

    it('rejects when the requester is not an admin', async () => {
      mockAdmins({ 'dep-1': [OTHER_RESP_ID] });
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: OTHER_RESP_ID,
        responsibles: [{ id: ADMIN_ID }, { id: OTHER_RESP_ID }],
      });

      await expect(
        service.requestAdminTransfer('dep-1', ADMIN_ID, STRANGER_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when the target is not already a responsible', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID] });
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [{ id: ADMIN_ID }],
      });

      await expect(
        service.requestAdminTransfer('dep-1', STRANGER_ID, ADMIN_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the target is already an admin', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID, OTHER_RESP_ID] });
      dependentRepo.findOne.mockResolvedValue({
        id: 'dep-1',
        adminResponsibleId: ADMIN_ID,
        responsibles: [
          { id: ADMIN_ID, email: 'a@x.com' },
          { id: OTHER_RESP_ID, email: 'o@x.com' },
        ],
      });

      await expect(
        service.requestAdminTransfer('dep-1', OTHER_RESP_ID, ADMIN_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove (delete dependent)', () => {
    it('blocks deletion when there is more than one admin', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID, OTHER_RESP_ID] });
      dependentRepo.findOne.mockResolvedValue({ id: 'dep-1', adminResponsibleId: ADMIN_ID });

      await expect(service.remove('dep-1', ADMIN_ID)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows deletion by the sole admin', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID] });
      dependentRepo.findOne.mockResolvedValue({ id: 'dep-1', adminResponsibleId: ADMIN_ID });

      const result = await service.remove('dep-1', ADMIN_ID);
      expect(result.message).toMatch(/deleted/i);
    });

    it('rejects when a non-admin tries to delete', async () => {
      mockAdmins({ 'dep-1': [ADMIN_ID] });
      dependentRepo.findOne.mockResolvedValue({ id: 'dep-1', adminResponsibleId: ADMIN_ID });

      await expect(service.remove('dep-1', STRANGER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
