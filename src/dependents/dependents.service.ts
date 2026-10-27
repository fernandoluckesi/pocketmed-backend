import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Dependent } from '../entities/dependent.entity';
import { Patient } from '../entities/patient.entity';
import {
  DependentResponsibleInvite,
  ResponsibleInviteStatus,
  ResponsibleInviteKind,
} from '../entities/dependent-responsible-invite.entity';
import { UploadService } from '../upload/upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDependentDto } from './dto/create-dependent.dto';
import { UpdateDependentDto } from './dto/update-dependent.dto';

const RESPONSIBLE_INVITE_CREATED = 'RESPONSIBLE_INVITE_CREATED';
const RESPONSIBLE_INVITE_RESPONDED = 'RESPONSIBLE_INVITE_RESPONDED';
const ADMIN_TRANSFER_REQUESTED = 'ADMIN_TRANSFER_REQUESTED';
const ADMIN_TRANSFER_RESPONDED = 'ADMIN_TRANSFER_RESPONDED';

@Injectable()
export class DependentsService {
  constructor(
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(DependentResponsibleInvite)
    private inviteRepository: Repository<DependentResponsibleInvite>,
    private uploadService: UploadService,
    private notificationsService: NotificationsService,
  ) {}

  // ── Admin helpers (multiple admins live on the join table isAdmin flag) ────

  /** Patient ids that are admins of a dependent (reads the join table). */
  private async getAdminIds(dependentId: string): Promise<string[]> {
    const rows: Array<{ patientId: string }> = await this.dependentRepository.query(
      'SELECT patientId FROM dependent_responsibles WHERE dependentId = ? AND isAdmin = 1',
      [dependentId],
    );
    return rows.map((r) => r.patientId);
  }

  private async isAdmin(dependentId: string, userId: string): Promise<boolean> {
    const admins = await this.getAdminIds(dependentId);
    return admins.includes(userId);
  }

  private async setAdminFlag(
    dependentId: string,
    patientId: string,
    isAdmin: boolean,
  ): Promise<void> {
    await this.dependentRepository.query(
      'UPDATE dependent_responsibles SET isAdmin = ? WHERE dependentId = ? AND patientId = ?',
      [isAdmin ? 1 : 0, dependentId, patientId],
    );
  }

  async create(userId: string, dto: CreateDependentDto, file?: Express.Multer.File) {
    const patient = await this.patientRepository.findOne({
      where: { id: userId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    let profileImageUrl = null;
    if (file) {
      profileImageUrl = await this.uploadService.uploadFile(file, 'profiles');
    }

    const dependent = this.dependentRepository.create({
      name: dto.name,
      gender: dto.gender,
      type: dto.type,
      birthDate: new Date(dto.birthDate),
      profileImage: profileImageUrl,
      adminResponsibleId: userId,
      responsibles: [patient],
    });

    const saved = await this.dependentRepository.save(dependent);

    // The creator is the first admin on the join table too.
    await this.setAdminFlag(saved.id, userId, true);

    return saved;
  }

  /**
   * Updates a dependent's own data (name, gender, type, birthDate, photo).
   * Only the admin responsible may edit — same boundary as delete.
   */
  async update(id: string, userId: string, dto: UpdateDependentDto, file?: Express.Multer.File) {
    const dependent = await this.dependentRepository.findOne({
      where: { id },
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (!(await this.isAdmin(id, userId))) {
      throw new ForbiddenException('Only an admin responsible can edit the dependent');
    }

    if (file) {
      dependent.profileImage = await this.uploadService.uploadFile(file, 'profiles');
    }

    if (dto.name !== undefined) dependent.name = dto.name;
    if (dto.gender !== undefined) dependent.gender = dto.gender;
    if (dto.type !== undefined) dependent.type = dto.type;
    if (dto.birthDate !== undefined) dependent.birthDate = new Date(dto.birthDate);

    return await this.dependentRepository.save(dependent);
  }

  /**
   * Describes what would happen to the user's dependents if they deleted their
   * account. Only considers dependents where the user is the ADMIN (creator).
   * For each, reports the other responsibles (already-linked patients) so the
   * client can offer transferring administration, or warns that the dependent
   * would be deleted when there is no one else to take over.
   *
   * This is used by the account-deletion flow to resolve the dependents'
   * destiny BEFORE the account is deleted — the deletion itself never waits on
   * a third party.
   */
  async getDeletionImpact(userId: string) {
    // Dependents where this user is an admin (via the join flag) — not just the
    // legacy root pointer, since there can be multiple admins now.
    const adminRows: Array<{ dependentId: string }> = await this.dependentRepository.query(
      'SELECT dependentId FROM dependent_responsibles WHERE patientId = ? AND isAdmin = 1',
      [userId],
    );
    const adminDependentIds = adminRows.map((r) => r.dependentId);

    if (adminDependentIds.length === 0) {
      return { hasAdminDependents: false, dependents: [] };
    }

    const dependents = await this.dependentRepository.find({
      where: { id: In(adminDependentIds) },
      relations: ['responsibles'],
    });

    const adminDependents = await Promise.all(
      dependents.map(async (dependent) => {
        const adminIds = await this.getAdminIds(dependent.id);
        // If another admin remains after this user leaves, the dependent keeps
        // an owner — no action needed from the user.
        const hasOtherAdmin = adminIds.some((id) => id !== userId);

        const otherResponsibles = (dependent.responsibles || [])
          .filter((r) => r.id !== userId)
          .map((r) => ({
            id: r.id,
            name: r.name,
            profileImage: r.profileImage ?? null,
          }));

        return {
          id: dependent.id,
          name: dependent.name,
          profileImage: dependent.profileImage ?? null,
          hasOtherAdmin,
          hasOtherResponsibles: otherResponsibles.length > 0,
          otherResponsibles,
        };
      }),
    );

    // Only dependents WITHOUT another admin require the user to decide what
    // happens before deleting their account.
    const needingAction = adminDependents.filter((d) => !d.hasOtherAdmin);

    return {
      hasAdminDependents: needingAction.length > 0,
      dependents: needingAction,
    };
  }

  /**
   * Transfers administration of a dependent to another patient who is ALREADY
   * a responsible for that dependent. This is a direct transfer (no invite /
   * acceptance) because the target already consented to being a responsible.
   * Used both from the dependent details screen and the account-deletion flow.
   */
  async transferAdmin(dependentId: string, newAdminId: string, requestUserId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id: dependentId },
      relations: ['responsibles'],
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (dependent.adminResponsibleId !== requestUserId) {
      throw new ForbiddenException('Only the admin responsible can transfer administration');
    }

    if (newAdminId === requestUserId) {
      throw new BadRequestException('You are already the admin of this dependent');
    }

    const isResponsible = (dependent.responsibles || []).some((r) => r.id === newAdminId);
    if (!isResponsible) {
      throw new BadRequestException(
        'The new admin must already be a responsible for this dependent',
      );
    }

    dependent.adminResponsibleId = newAdminId;
    await this.dependentRepository.save(dependent);

    return {
      message: 'Administration transferred successfully',
      dependentId: dependent.id,
      adminResponsibleId: newAdminId,
    };
  }

  async findAll(userId: string) {
    const dependents = await this.dependentRepository
      .createQueryBuilder('dependent')
      .leftJoinAndSelect('dependent.responsibles', 'responsibles')
      .where('responsibles.id = :userId', { userId })
      .getMany();

    // Tell the client whether the requesting user is an admin of each
    // dependent (multiple admins supported — the legacy adminResponsibleId
    // pointer alone is no longer sufficient).
    const adminRows: Array<{ dependentId: string }> = await this.dependentRepository.query(
      'SELECT dependentId FROM dependent_responsibles WHERE patientId = ? AND isAdmin = 1',
      [userId],
    );
    const adminDependentIds = new Set(adminRows.map((r) => r.dependentId));

    return dependents.map((d) => ({
      ...d,
      isCurrentUserAdmin: adminDependentIds.has(d.id),
    }));
  }

  async findOne(id: string, userId: string) {
    // Access control via EXISTS on the join table, so the returned
    // `responsibles` list isn't narrowed to just the requesting user — we need
    // ALL responsibles for the details screen. The subquery only gates access.
    const dependent = await this.dependentRepository
      .createQueryBuilder('dependent')
      .leftJoinAndSelect('dependent.responsibles', 'responsibles')
      .where('dependent.id = :id', { id })
      .andWhere((qb) => {
        const sub = qb
          .subQuery()
          .select('1')
          .from('dependent_responsibles', 'dr')
          .where('dr.dependentId = dependent.id')
          .andWhere('dr.patientId = :userId')
          .getQuery();
        return `EXISTS ${sub}`;
      })
      .setParameter('userId', userId)
      .getOne();

    if (!dependent) {
      throw new NotFoundException('Dependent not found or you do not have access');
    }

    // Expose which responsibles are admins (multiple admins supported) and
    // which ones have a PENDING "become admin" request, so the client can show
    // "Solicitação enviada" instead of letting the admin request again.
    const adminIds = await this.getAdminIds(id);
    const pendingAdminInvites = await this.inviteRepository.find({
      where: {
        dependentId: id,
        kind: ResponsibleInviteKind.ADMIN_TRANSFER,
        status: ResponsibleInviteStatus.PENDING,
      },
      select: ['inviteePatientId'],
    });
    const pendingAdminInviteeIds = pendingAdminInvites.map((i) => i.inviteePatientId);

    return { ...dependent, adminIds, pendingAdminInviteeIds };
  }

  async addResponsible(dependentId: string, patientId: string, requestUserId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id: dependentId },
      relations: ['responsibles'],
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (!(await this.isAdmin(dependentId, requestUserId))) {
      throw new ForbiddenException('Only an admin responsible can add new responsibles');
    }

    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const alreadyResponsible = dependent.responsibles.some((r) => r.id === patientId);

    if (alreadyResponsible) {
      throw new ForbiddenException('Patient is already a responsible');
    }

    dependent.responsibles.push(patient);

    await this.dependentRepository.save(dependent);

    return {
      message: 'Responsible added successfully',
      dependent,
    };
  }

  /**
   * Look up an active (non-shadow) patient by exact email. Used by the
   * "Adicionar Responsável" screen to resolve a user before inviting them.
   * Only the dependent's admin responsible may perform this lookup.
   */
  async searchUserByEmail(dependentId: string, email: string, requestUserId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id: dependentId },
      relations: ['responsibles'],
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (!(await this.isAdmin(dependentId, requestUserId))) {
      throw new ForbiddenException('Only an admin responsible can invite responsibles');
    }

    const normalizedEmail = email.trim().toLowerCase();

    const patient = await this.patientRepository.findOne({
      where: { email: normalizedEmail, isShadow: false },
    });

    if (!patient) {
      throw new NotFoundException('No active user found with this email');
    }

    if (patient.id === requestUserId) {
      throw new BadRequestException('You are already responsible for this dependent');
    }

    const alreadyResponsible = dependent.responsibles.some((r) => r.id === patient.id);
    if (alreadyResponsible) {
      throw new BadRequestException('This user is already a responsible for this dependent');
    }

    return {
      id: patient.id,
      name: patient.name,
      email: patient.email,
      profileImage: patient.profileImage ?? null,
    };
  }

  /**
   * Create an invite for another patient to become a responsible for the
   * dependent. Only the admin responsible may invite. The invitee receives a
   * notification and can accept or reject it (mirrors the doctor access flow).
   */
  async inviteResponsible(dependentId: string, email: string, requestUserId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id: dependentId },
      relations: ['responsibles'],
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (!(await this.isAdmin(dependentId, requestUserId))) {
      throw new ForbiddenException('Only an admin responsible can invite responsibles');
    }

    const normalizedEmail = email.trim().toLowerCase();

    const invitee = await this.patientRepository.findOne({
      where: { email: normalizedEmail, isShadow: false },
    });

    if (!invitee) {
      throw new NotFoundException('No active user found with this email');
    }

    if (invitee.id === requestUserId) {
      throw new BadRequestException('You are already responsible for this dependent');
    }

    const alreadyResponsible = dependent.responsibles.some((r) => r.id === invitee.id);
    if (alreadyResponsible) {
      throw new BadRequestException('This user is already a responsible for this dependent');
    }

    const existingPending = await this.inviteRepository.findOne({
      where: {
        dependentId,
        inviteePatientId: invitee.id,
        status: ResponsibleInviteStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new BadRequestException('An invite is already pending for this user');
    }

    const inviter = await this.patientRepository.findOne({
      where: { id: requestUserId },
    });

    const invite = this.inviteRepository.create({
      dependentId,
      inviterPatientId: requestUserId,
      inviteePatientId: invitee.id,
      inviteeEmail: invitee.email,
      status: ResponsibleInviteStatus.PENDING,
    });

    const savedInvite = await this.inviteRepository.save(invite);

    this.notificationsService
      .createNotification(
        invitee.id,
        'patient',
        'Convite para ser responsável',
        `${inviter?.name ?? 'Um usuário'} convidou você para ser responsável por ${dependent.name}.`,
        RESPONSIBLE_INVITE_CREATED,
        {
          dependentId,
          dependentName: dependent.name,
          inviterId: requestUserId,
          inviterName: inviter?.name ?? '',
        },
        savedInvite.id,
      )
      .catch(() => {
        /* notification is best-effort */
      });

    return {
      message: 'Invite sent successfully',
      invite: savedInvite,
    };
  }

  /**
   * Accept or reject a responsible invite. Only the invitee may respond.
   * On accept, the invitee is added to the dependent's responsibles.
   */
  async respondToInvite(inviteId: string, status: ResponsibleInviteStatus, requestUserId: string) {
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId },
      relations: ['dependent', 'dependent.responsibles'],
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.inviteePatientId !== requestUserId) {
      throw new ForbiddenException('You can only respond to your own invites');
    }

    if (invite.status !== ResponsibleInviteStatus.PENDING) {
      throw new BadRequestException('This invite has already been responded to');
    }

    invite.status = status;
    await this.inviteRepository.save(invite);

    const isAdminTransfer = invite.kind === ResponsibleInviteKind.ADMIN_TRANSFER;
    const createdType = isAdminTransfer ? ADMIN_TRANSFER_REQUESTED : RESPONSIBLE_INVITE_CREATED;

    await this.notificationsService.syncNotificationStatusByType(invite.id, createdType, status);

    if (status === ResponsibleInviteStatus.ACCEPTED) {
      const invitee = await this.patientRepository.findOne({
        where: { id: invite.inviteePatientId },
      });

      const alreadyResponsible = invite.dependent.responsibles.some(
        (r) => r.id === invite.inviteePatientId,
      );

      // Ensure the invitee is a responsible of the dependent.
      if (invitee && !alreadyResponsible) {
        invite.dependent.responsibles.push(invitee);
        await this.dependentRepository.save(invite.dependent);
      }

      // Admin transfer ADDS the invitee as an admin (multiple admins allowed);
      // existing admins keep their role. The join row exists now (either it was
      // there, or the save above created it), so flip the isAdmin flag.
      if (isAdminTransfer && invitee) {
        await this.setAdminFlag(invite.dependentId, invitee.id, true);
      }
    }

    const respondedType = isAdminTransfer ? ADMIN_TRANSFER_RESPONDED : RESPONSIBLE_INVITE_RESPONDED;
    const accepted = status === ResponsibleInviteStatus.ACCEPTED;
    const title = isAdminTransfer
      ? accepted
        ? 'Novo administrador aceito'
        : 'Solicitação de administrador recusada'
      : accepted
        ? 'Convite aceito!'
        : 'Convite recusado';
    const body = isAdminTransfer
      ? accepted
        ? `${invite.dependent.name} agora tem um novo administrador.`
        : `Sua solicitação para tornar um responsável administrador de ${invite.dependent.name} foi recusada.`
      : accepted
        ? `Seu convite para gerenciar ${invite.dependent.name} foi aceito.`
        : `Seu convite para gerenciar ${invite.dependent.name} foi recusado.`;

    this.notificationsService
      .createNotification(
        invite.inviterPatientId,
        'patient',
        title,
        body,
        respondedType,
        {
          status,
          dependentId: invite.dependentId,
          dependentName: invite.dependent.name,
        },
        invite.id,
      )
      .catch(() => {
        /* notification is best-effort */
      });

    return {
      message: `Invite ${status}`,
      invite,
    };
  }

  /**
   * Lets a NON-admin responsible step down (stop being responsible for the
   * dependent). The admin can't use this — they must either transfer admin to
   * someone else first, or delete the dependent (handled on the client via the
   * deletion-impact flow). Returns whether any responsible remains.
   */
  async leaveResponsible(dependentId: string, userId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id: dependentId },
      relations: ['responsibles'],
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    const isResponsible = (dependent.responsibles || []).some((r) => r.id === userId);
    if (!isResponsible) {
      throw new ForbiddenException('You are not a responsible for this dependent');
    }

    const adminIds = await this.getAdminIds(dependentId);
    const userIsAdmin = adminIds.includes(userId);

    // An admin can only leave if there is ANOTHER admin to keep ownership.
    // Otherwise they must promote someone first, or (if they're the only
    // responsible) delete the dependent — handled on the client.
    if (userIsAdmin) {
      const otherAdmins = adminIds.filter((id) => id !== userId);
      if (otherAdmins.length === 0) {
        throw new BadRequestException(
          'You are the only admin. Promote another responsible to admin first, or delete the dependent.',
        );
      }
    }

    dependent.responsibles = dependent.responsibles.filter((r) => r.id !== userId);
    await this.dependentRepository.save(dependent);
    // Leaving also drops any admin role (join row is gone after the save, but
    // clear defensively in case the ORM keeps it).
    await this.setAdminFlag(dependentId, userId, false);

    // If the leaving user was the legacy "root" admin, hand that pointer to
    // another remaining admin so the deletion/merge SQL stays consistent.
    if (dependent.adminResponsibleId === userId) {
      const remainingAdmins = (await this.getAdminIds(dependentId)).filter((id) => id !== userId);
      if (remainingAdmins.length > 0) {
        await this.dependentRepository.update(dependentId, {
          adminResponsibleId: remainingAdmins[0],
        });
      }
    }

    // Cancel any still-pending invites targeting this user for this dependent.
    await this.inviteRepository.update(
      {
        dependentId,
        inviteePatientId: userId,
        status: ResponsibleInviteStatus.PENDING,
      },
      { status: ResponsibleInviteStatus.REJECTED },
    );

    return { message: 'You are no longer responsible for this dependent' };
  }

  /**
   * Lets an admin step DOWN from admin while staying a responsible. Only
   * allowed when there is at least one OTHER admin (a dependent must always
   * have an admin).
   */
  async leaveAdmin(dependentId: string, userId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id: dependentId },
      relations: ['responsibles'],
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    const adminIds = await this.getAdminIds(dependentId);
    if (!adminIds.includes(userId)) {
      throw new BadRequestException('You are not an admin of this dependent');
    }

    const otherAdmins = adminIds.filter((id) => id !== userId);
    if (otherAdmins.length === 0) {
      throw new BadRequestException(
        'You are the only admin. Promote another responsible to admin first.',
      );
    }

    await this.setAdminFlag(dependentId, userId, false);

    // Keep the legacy root pointer valid.
    if (dependent.adminResponsibleId === userId) {
      await this.dependentRepository.update(dependentId, {
        adminResponsibleId: otherAdmins[0],
      });
    }

    return { message: 'You are no longer an admin of this dependent' };
  }

  /**
   * The admin asks an EXISTING responsible to take over as admin. This is a
   * request/accept flow (not an immediate transfer): the target gets a
   * notification and must accept; the admin is notified of the outcome.
   */
  async requestAdminTransfer(
    dependentId: string,
    targetResponsibleId: string,
    requestUserId: string,
  ) {
    const dependent = await this.dependentRepository.findOne({
      where: { id: dependentId },
      relations: ['responsibles'],
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (!(await this.isAdmin(dependentId, requestUserId))) {
      throw new ForbiddenException('Only an admin responsible can promote another admin');
    }

    if (targetResponsibleId === requestUserId) {
      throw new BadRequestException('You are already an admin of this dependent');
    }

    const target = (dependent.responsibles || []).find((r) => r.id === targetResponsibleId);
    if (!target) {
      throw new BadRequestException('The new admin must already be a responsible');
    }

    // Promoting ADDS another admin (it doesn't replace existing ones), so if the
    // target is already an admin there's nothing to do.
    if (await this.isAdmin(dependentId, targetResponsibleId)) {
      throw new BadRequestException('This responsible is already an admin');
    }

    const existingPending = await this.inviteRepository.findOne({
      where: {
        dependentId,
        inviteePatientId: targetResponsibleId,
        kind: ResponsibleInviteKind.ADMIN_TRANSFER,
        status: ResponsibleInviteStatus.PENDING,
      },
    });
    if (existingPending) {
      throw new BadRequestException('An admin request is already pending for this responsible');
    }

    const inviter = await this.patientRepository.findOne({ where: { id: requestUserId } });

    const invite = this.inviteRepository.create({
      dependentId,
      inviterPatientId: requestUserId,
      inviteePatientId: targetResponsibleId,
      inviteeEmail: target.email,
      kind: ResponsibleInviteKind.ADMIN_TRANSFER,
      status: ResponsibleInviteStatus.PENDING,
    });

    const savedInvite = await this.inviteRepository.save(invite);

    this.notificationsService
      .createNotification(
        targetResponsibleId,
        'patient',
        'Solicitação para ser administrador',
        `${inviter?.name ?? 'Um administrador'} quer tornar você administrador de ${dependent.name}.`,
        ADMIN_TRANSFER_REQUESTED,
        {
          dependentId,
          dependentName: dependent.name,
          inviterId: requestUserId,
          inviterName: inviter?.name ?? '',
        },
        savedInvite.id,
      )
      .catch(() => {
        /* best-effort */
      });

    return {
      message: 'Admin transfer request sent successfully',
      invite: savedInvite,
    };
  }

  /**
   * Admin removes ANOTHER responsible from the dependent. The admin can't
   * remove themselves here (they must transfer admin or delete the dependent).
   */
  async removeResponsible(dependentId: string, responsibleId: string, requestUserId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id: dependentId },
      relations: ['responsibles'],
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (!(await this.isAdmin(dependentId, requestUserId))) {
      throw new ForbiddenException('Only an admin responsible can remove responsibles');
    }

    if (responsibleId === requestUserId) {
      throw new BadRequestException(
        'The admin cannot remove themselves. Use "leave" or delete the dependent.',
      );
    }

    const isResponsible = (dependent.responsibles || []).some((r) => r.id === responsibleId);
    if (!isResponsible) {
      throw new BadRequestException('This user is not a responsible for this dependent');
    }

    // Admins don't remove other admins (avoids ownership conflicts). The other
    // admin must leave/step down themselves.
    if (await this.isAdmin(dependentId, responsibleId)) {
      throw new BadRequestException('You cannot remove another admin');
    }

    dependent.responsibles = dependent.responsibles.filter((r) => r.id !== responsibleId);
    await this.dependentRepository.save(dependent);
    await this.setAdminFlag(dependentId, responsibleId, false);

    // Cancel any pending invites targeting the removed responsible.
    await this.inviteRepository.update(
      {
        dependentId,
        inviteePatientId: responsibleId,
        status: ResponsibleInviteStatus.PENDING,
      },
      { status: ResponsibleInviteStatus.REJECTED },
    );

    return { message: 'Responsible removed successfully' };
  }

  async remove(id: string, userId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id },
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (!(await this.isAdmin(id, userId))) {
      throw new ForbiddenException('Only an admin responsible can delete the dependent');
    }

    // With more than one admin, deletion is blocked — all admins would lose the
    // dependent. Admins must agree down to a single admin before deleting.
    const adminIds = await this.getAdminIds(id);
    if (adminIds.length > 1) {
      throw new BadRequestException(
        'This dependent has more than one admin and cannot be deleted. It can only be deleted when there is a single admin.',
      );
    }

    await this.dependentRepository.remove(dependent);

    return {
      message: 'Dependent deleted successfully',
    };
  }
}
