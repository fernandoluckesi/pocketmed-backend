import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClinicDoctorInvite, InviteStatus } from './entities/clinic-doctor-invite.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { ProfessionalRole } from '../auth/professional-role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { RespondInviteDto } from './dto/respond-invite.dto';

export interface DoctorSearchResult {
  id: string;
  name: string;
  specialty: string;
  crm: string;
  profileImage: string | null;
}

export interface DashboardDoctorItem {
  id: string;
  name: string;
  specialty: string;
  patientCount: number;
}

export interface DashboardResponse {
  doctors: DashboardDoctorItem[];
}

export interface PatientListItem {
  id: string;
  name: string;
}

@Injectable()
export class ClinicDoctorAssociationService {
  constructor(
    @InjectRepository(ClinicDoctorInvite)
    private readonly inviteRepository: Repository<ClinicDoctorInvite>,
    @InjectRepository(ClinicMembership)
    private readonly membershipRepository: Repository<ClinicMembership>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(DoctorPermission)
    private readonly doctorPermissionRepository: Repository<DoctorPermission>,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async createInvite(
    user: { userId: string; activeClinicId: string | null },
    dto: CreateInviteDto,
  ): Promise<ClinicDoctorInvite> {
    const clinicId = user.activeClinicId;

    // Validate target doctor exists
    const doctor = await this.doctorRepository.findOne({
      where: { id: dto.doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Médico não encontrado');
    }

    // Check for existing pending invite for same clinic-doctor pair
    const existingPendingInvite = await this.inviteRepository.findOne({
      where: {
        clinicId,
        doctorId: dto.doctorId,
        status: InviteStatus.PENDING,
      },
    });

    if (existingPendingInvite) {
      throw new ConflictException('Já existe uma solicitação pendente para este médico');
    }

    // Check for active membership for same clinic-doctor pair
    const existingMembership = await this.membershipRepository.findOne({
      where: {
        clinicId,
        professionalId: dto.doctorId,
        isActive: true,
      },
    });

    if (existingMembership) {
      throw new ConflictException('O médico já está associado à clínica');
    }

    // Create the invite
    const invite = this.inviteRepository.create({
      clinicId,
      doctorId: dto.doctorId,
      invitedBy: user.userId,
      status: InviteStatus.PENDING,
    });

    const savedInvite = await this.inviteRepository.save(invite);

    // Send notification to the doctor
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });

    const admin = await this.doctorRepository.findOne({
      where: { id: user.userId },
    });

    const clinicName = clinic?.name || 'Clínica';
    const adminName = admin?.name || 'Administrador';

    await this.notificationsService.createNotification(
      dto.doctorId,
      'doctor',
      'Convite para clínica',
      `Você recebeu um convite de ${adminName} para se associar à clínica ${clinicName}.`,
      'CLINIC_INVITE_CREATED',
      {
        inviteId: savedInvite.id,
        clinicId,
        clinicName,
        adminName,
      },
      savedInvite.id,
    );

    return savedInvite;
  }

  async respondToInvite(
    user: { userId: string; activeClinicId: string | null },
    inviteId: string,
    dto: RespondInviteDto,
  ): Promise<void> {
    // Load invite by ID
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId },
      relations: ['clinic'],
    });

    if (!invite) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    // Validate it belongs to the requesting doctor
    if (invite.doctorId !== user.userId) {
      throw new ForbiddenException('Acesso negado');
    }

    // Validate invite status is "pending"
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Esta solicitação já foi respondida');
    }

    // Validate decision
    if (dto.decision !== 'accepted' && dto.decision !== 'rejected') {
      throw new BadRequestException("Valor de decisão inválido. Use 'accepted' ou 'rejected'");
    }

    if (dto.decision === 'accepted') {
      // Enforce 20-clinic limit before proceeding
      const activeMembershipCount = await this.membershipRepository.count({
        where: {
          professionalId: user.userId,
          isActive: true,
        },
      });

      if (activeMembershipCount >= 20) {
        throw new UnprocessableEntityException('Limite máximo de 20 clínicas atingido');
      }

      // Wrap acceptance in a transaction
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Update invite status to approved
        invite.status = InviteStatus.APPROVED;
        await queryRunner.manager.save(invite);

        // Check for existing inactive membership to reactivate
        const existingMembership = await queryRunner.manager.findOne(ClinicMembership, {
          where: {
            clinicId: invite.clinicId,
            professionalId: invite.doctorId,
          },
        });

        if (existingMembership) {
          // Reactivate existing membership
          existingMembership.isActive = true;
          existingMembership.invitedBy = invite.invitedBy;
          await queryRunner.manager.save(existingMembership);
        } else {
          // Create new ClinicMembership
          const membership = queryRunner.manager.create(ClinicMembership, {
            clinicId: invite.clinicId,
            professionalId: invite.doctorId,
            role: ProfessionalRole.DOCTOR,
            isActive: true,
            invitedBy: invite.invitedBy,
          });
          await queryRunner.manager.save(membership);
        }

        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } else {
      // Rejected: just update invite status
      invite.status = InviteStatus.REJECTED;
      await this.inviteRepository.save(invite);
    }

    // Send notification to admin with doctor name and decision
    const doctor = await this.doctorRepository.findOne({
      where: { id: user.userId },
    });

    const doctorName = doctor?.name || 'Médico';
    const clinicName = invite.clinic?.name || 'Clínica';

    const decisionText = dto.decision === 'accepted' ? 'aceitou' : 'rejeitou';

    await this.notificationsService.createNotification(
      invite.invitedBy,
      'doctor',
      'Resposta ao convite',
      `${doctorName} ${decisionText} o convite para se associar à clínica ${clinicName}.`,
      'CLINIC_INVITE_RESPONDED',
      {
        inviteId: invite.id,
        clinicId: invite.clinicId,
        doctorName,
        decision: dto.decision,
      },
      invite.id,
    );
  }

  async searchDoctorByCrm(crm: string, state: string): Promise<DoctorSearchResult> {
    if (!crm || !state) {
      throw new BadRequestException('CRM e Estado são obrigatórios');
    }

    // Normalize: build both possible stored formats
    const upperState = state.toUpperCase();
    const formatDash = `${upperState}-${crm}`; // "SP-123456"
    const formatSlash = `${crm}/${upperState}`; // "123456/SP"

    const doctor = await this.doctorRepository.findOne({
      where: [{ crm: formatDash }, { crm: formatSlash }],
      select: ['id', 'name', 'specialty', 'crm', 'profileImage'],
    });

    if (!doctor) {
      throw new NotFoundException('Nenhum médico encontrado com o CRM informado');
    }

    return {
      id: doctor.id,
      name: doctor.name,
      specialty: doctor.specialty,
      crm: doctor.crm,
      profileImage: doctor.profileImage,
    };
  }

  async getReceivedInvites(doctorId: string): Promise<ClinicDoctorInvite[]> {
    return this.inviteRepository.find({
      where: { doctorId },
      relations: ['clinic'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSentInvites(clinicId: string): Promise<ClinicDoctorInvite[]> {
    return this.inviteRepository.find({
      where: { clinicId },
      relations: ['doctor'],
      order: { createdAt: 'DESC' },
    });
  }

  async cancelInvite(
    user: { userId: string; activeClinicId: string | null },
    inviteId: string,
  ): Promise<void> {
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Solicitação não encontrada');
    }

    if (invite.clinicId !== user.activeClinicId) {
      throw new ForbiddenException('Acesso negado');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Somente solicitações pendentes podem ser canceladas');
    }

    invite.status = InviteStatus.CANCELLED;
    await this.inviteRepository.save(invite);
  }

  /**
   * Returns all active clinic memberships for a doctor, ordered by createdAt ascending.
   * Joins the clinic entity to include clinic name.
   */
  async getMyClinics(doctorId: string): Promise<ClinicMembership[]> {
    return this.membershipRepository.find({
      where: {
        professionalId: doctorId,
        isActive: true,
      },
      relations: ['clinic'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Admin action: removes a member from the clinic by deactivating the membership.
   * Validates admin role, membership existence, active status, and last-admin constraint.
   */
  async removeMember(
    user: { userId: string; activeClinicId: string; role: string },
    membershipId: string,
  ): Promise<void> {
    // Validate admin role
    if (user.role !== ProfessionalRole.ADMIN) {
      throw new ForbiddenException('Acesso negado por falta de permissão administrativa');
    }

    // Find the membership in the admin's active clinic
    const membership = await this.membershipRepository.findOne({
      where: { id: membershipId, clinicId: user.activeClinicId },
    });

    if (!membership) {
      throw new NotFoundException('Associação não encontrada');
    }

    // Check if already inactive
    if (!membership.isActive) {
      throw new BadRequestException('A associação já se encontra inativa');
    }

    // Check if removing self as last admin
    if (membership.professionalId === user.userId) {
      const activeAdminCount = await this.membershipRepository.count({
        where: {
          clinicId: user.activeClinicId,
          role: ProfessionalRole.ADMIN,
          isActive: true,
        },
      });

      if (activeAdminCount <= 1) {
        throw new UnprocessableEntityException(
          'O último administrador ativo não pode ser removido da clínica',
        );
      }
    }

    // Deactivate membership (soft-delete)
    membership.isActive = false;
    await this.membershipRepository.save(membership);

    // Send notification to the removed doctor
    const clinic = await this.clinicRepository.findOne({
      where: { id: user.activeClinicId },
    });
    const clinicName = clinic?.name || 'Clínica';

    await this.notificationsService.createNotification(
      membership.professionalId,
      'doctor',
      'Remoção da clínica',
      `Sua associação com a clínica ${clinicName} foi encerrada pelo administrador.`,
      'CLINIC_MEMBERSHIP_REMOVED',
      {
        clinicId: user.activeClinicId,
        clinicName,
        membershipId,
      },
      membershipId,
    );
  }

  /**
   * Doctor action: leaves a clinic by deactivating their own membership.
   * Validates membership ownership and active status.
   */
  async leaveClinic(user: { userId: string }, membershipId: string): Promise<void> {
    // Find the membership
    const membership = await this.membershipRepository.findOne({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Associação não encontrada');
    }

    // Validate membership belongs to the requesting doctor
    if (membership.professionalId !== user.userId) {
      throw new ForbiddenException('Acesso negado');
    }

    // Check if already inactive
    if (!membership.isActive) {
      throw new BadRequestException('A associação já se encontra inativa');
    }

    // Deactivate membership (soft-delete)
    membership.isActive = false;
    await this.membershipRepository.save(membership);

    // Send notification to the clinic admin(s)
    const clinic = await this.clinicRepository.findOne({
      where: { id: membership.clinicId },
    });
    const clinicName = clinic?.name || 'Clínica';

    const doctor = await this.doctorRepository.findOne({
      where: { id: user.userId },
    });
    const doctorName = doctor?.name || 'Médico';

    // Find active admins of the clinic to notify
    const admins = await this.membershipRepository.find({
      where: {
        clinicId: membership.clinicId,
        role: ProfessionalRole.ADMIN,
        isActive: true,
      },
    });

    for (const admin of admins) {
      await this.notificationsService.createNotification(
        admin.professionalId,
        'doctor',
        'Médico saiu da clínica',
        `O médico ${doctorName} encerrou sua associação com a clínica ${clinicName}.`,
        'CLINIC_MEMBERSHIP_LEFT',
        {
          clinicId: membership.clinicId,
          clinicName,
          doctorName,
          membershipId,
        },
        membershipId,
      );
    }
  }

  /**
   * Returns the clinic dashboard with doctors and their patient counts.
   * Queries doctors with role "doctor" and active membership in the clinic,
   * ordered alphabetically by name (case-insensitive).
   * For each doctor, counts active DoctorPermissions (isActive=true, patientId not null).
   */
  async getClinicDashboard(clinicId: string): Promise<DashboardResponse> {
    try {
      // Query doctors with role "doctor" and active membership in the clinic
      const memberships = await this.membershipRepository.find({
        where: {
          clinicId,
          role: ProfessionalRole.DOCTOR,
          isActive: true,
        },
        relations: ['professional'],
      });

      if (memberships.length === 0) {
        return { doctors: [] };
      }

      // Build dashboard items with patient counts
      const doctors: DashboardDoctorItem[] = await Promise.all(
        memberships.map(async (membership) => {
          const doctor = membership.professional;

          // Count active DoctorPermissions (isActive=true, patientId IS NOT NULL)
          const patientCount = await this.doctorPermissionRepository
            .createQueryBuilder('dp')
            .where('dp.doctorId = :doctorId', { doctorId: doctor.id })
            .andWhere('dp.isActive = :isActive', { isActive: true })
            .andWhere('dp.patientId IS NOT NULL')
            .getCount();

          return {
            id: doctor.id,
            name: doctor.name,
            specialty: doctor.specialty,
            patientCount,
          };
        }),
      );

      // Sort alphabetically by name (case-insensitive)
      doctors.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

      return { doctors };
    } catch (error) {
      throw new InternalServerErrorException('Indisponibilidade temporária ao carregar dados');
    }
  }

  /**
   * Returns patients of a specific doctor in a clinic.
   * Validates that the requesting user has an active membership in the clinic.
   * Returns only patient id and name, alphabetically ordered.
   */
  async getDoctorPatients(
    clinicId: string,
    doctorId: string,
    requestingUserId: string,
  ): Promise<PatientListItem[]> {
    // Validate requesting user has active membership in the clinic
    const activeMembership = await this.membershipRepository.findOne({
      where: {
        clinicId,
        professionalId: requestingUserId,
        isActive: true,
      },
    });

    if (!activeMembership) {
      throw new ForbiddenException('Acesso negado');
    }

    // Query patients with active DoctorPermission for the specified doctor
    const permissions = await this.doctorPermissionRepository.find({
      where: {
        doctorId,
        isActive: true,
      },
      relations: ['patient'],
    });

    // Filter to only permissions with a patient (patientId not null) and map to PatientListItem
    const patients: PatientListItem[] = permissions
      .filter((p) => p.patientId != null && p.patient != null)
      .map((p) => ({
        id: p.patient.id,
        name: p.patient.name,
      }));

    // Sort alphabetically by name (case-insensitive)
    patients.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    return patients;
  }
}
