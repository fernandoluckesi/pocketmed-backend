import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dependent } from '../entities/dependent.entity';
import { Patient } from '../entities/patient.entity';
import {
  DependentResponsibleInvite,
  ResponsibleInviteStatus,
} from '../entities/dependent-responsible-invite.entity';
import { UploadService } from '../upload/upload.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateDependentDto } from './dto/create-dependent.dto';

const RESPONSIBLE_INVITE_CREATED = 'RESPONSIBLE_INVITE_CREATED';
const RESPONSIBLE_INVITE_RESPONDED = 'RESPONSIBLE_INVITE_RESPONDED';

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
    const dependents = await this.dependentRepository.find({
      where: { adminResponsibleId: userId },
      relations: ['responsibles'],
    });

    const adminDependents = dependents.map((dependent) => {
      // Everyone linked as a responsible, except the current admin (the user
      // who is leaving). These are candidates to receive administration.
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
        hasOtherResponsibles: otherResponsibles.length > 0,
        otherResponsibles,
      };
    });

    return {
      // When there are no admin dependents, deletion can proceed with no extra
      // steps on the client.
      hasAdminDependents: adminDependents.length > 0,
      dependents: adminDependents,
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

    return dependents;
  }

  async findOne(id: string, userId: string) {
    const dependent = await this.dependentRepository
      .createQueryBuilder('dependent')
      .leftJoinAndSelect('dependent.responsibles', 'responsibles')
      .where('dependent.id = :id', { id })
      .andWhere('responsibles.id = :userId', { userId })
      .getOne();

    if (!dependent) {
      throw new NotFoundException('Dependent not found or you do not have access');
    }

    return dependent;
  }

  async addResponsible(dependentId: string, patientId: string, requestUserId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id: dependentId },
      relations: ['responsibles'],
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (dependent.adminResponsibleId !== requestUserId) {
      throw new ForbiddenException('Only the admin responsible can add new responsibles');
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

    if (dependent.adminResponsibleId !== requestUserId) {
      throw new ForbiddenException('Only the admin responsible can invite responsibles');
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

    if (dependent.adminResponsibleId !== requestUserId) {
      throw new ForbiddenException('Only the admin responsible can invite responsibles');
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

    await this.notificationsService.syncNotificationStatusByType(
      invite.id,
      RESPONSIBLE_INVITE_CREATED,
      status,
    );

    if (status === ResponsibleInviteStatus.ACCEPTED) {
      const invitee = await this.patientRepository.findOne({
        where: { id: invite.inviteePatientId },
      });

      const alreadyResponsible = invite.dependent.responsibles.some(
        (r) => r.id === invite.inviteePatientId,
      );

      if (invitee && !alreadyResponsible) {
        invite.dependent.responsibles.push(invitee);
        await this.dependentRepository.save(invite.dependent);
      }
    }

    this.notificationsService
      .createNotification(
        invite.inviterPatientId,
        'patient',
        status === ResponsibleInviteStatus.ACCEPTED ? 'Convite aceito!' : 'Convite recusado',
        status === ResponsibleInviteStatus.ACCEPTED
          ? `Seu convite para gerenciar ${invite.dependent.name} foi aceito.`
          : `Seu convite para gerenciar ${invite.dependent.name} foi recusado.`,
        RESPONSIBLE_INVITE_RESPONDED,
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

  async remove(id: string, userId: string) {
    const dependent = await this.dependentRepository.findOne({
      where: { id },
    });

    if (!dependent) {
      throw new NotFoundException('Dependent not found');
    }

    if (dependent.adminResponsibleId !== userId) {
      throw new ForbiddenException('Only the admin responsible can delete the dependent');
    }

    await this.dependentRepository.remove(dependent);

    return {
      message: 'Dependent deleted successfully',
    };
  }
}
