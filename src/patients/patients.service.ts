import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { ProfessionalRole } from '../auth/professional-role.enum';

@Injectable()
export class PatientsService {
  private readonly patientSelectFields: (keyof Patient)[] = [
    'id',
    'name',
    'email',
    'gender',
    'phone',
    'birthDate',
    'profileImage',
    'type',
    'isShadow',
    'doctorCreatorId',
    'createdAt',
    'updatedAt',
  ];

  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(DoctorPermission)
    private permissionRepository: Repository<DoctorPermission>,
    @InjectRepository(ClinicMembership)
    private clinicMembershipRepository: Repository<ClinicMembership>,
  ) {}

  private async getAccessiblePatientIdsForDoctor(doctorId: string): Promise<string[]> {
    const createdByDoctor = await this.patientRepository.find({
      where: { doctorCreatorId: doctorId },
      select: ['id'],
    });

    const permissions = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('permission.patientId', 'patientId')
      .where('permission.doctorId = :doctorId', { doctorId })
      .andWhere('permission.isActive = :isActive', { isActive: true })
      .andWhere('permission.patientId IS NOT NULL')
      .getRawMany<{ patientId: string }>();

    const ids = new Set<string>();
    for (const patient of createdByDoctor) {
      ids.add(patient.id);
    }
    for (const permission of permissions) {
      if (permission.patientId) {
        ids.add(permission.patientId);
      }
    }

    return Array.from(ids);
  }

  private async getClinicDoctorIds(clinicId: string): Promise<string[]> {
    const memberships = await this.clinicMembershipRepository.find({
      where: {
        clinicId,
        isActive: true,
        role: ProfessionalRole.DOCTOR,
      },
      select: ['professionalId'],
    });

    return memberships.map((membership) => membership.professionalId);
  }

  private async getClinicPatientIds(clinicId: string): Promise<string[]> {
    const doctorIds = await this.getClinicDoctorIds(clinicId);

    if (doctorIds.length === 0) {
      return [];
    }

    const createdPatients = await this.patientRepository.find({
      where: { doctorCreatorId: In(doctorIds) },
      select: ['id'],
    });

    const permissionRows = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('permission.patientId', 'patientId')
      .where('permission.doctorId IN (:...doctorIds)', { doctorIds })
      .andWhere('permission.isActive = :isActive', { isActive: true })
      .andWhere('permission.patientId IS NOT NULL')
      .getRawMany<{ patientId: string }>();

    const ids = new Set<string>();
    for (const patient of createdPatients) {
      ids.add(patient.id);
    }
    for (const row of permissionRows) {
      if (row.patientId) {
        ids.add(row.patientId);
      }
    }

    return Array.from(ids);
  }

  async getSummary(
    userType: string,
    userId?: string,
    userRole?: string | null,
    activeClinicId?: string | null,
  ) {
    if (userType !== 'doctor') {
      throw new ForbiddenException('Only professionals can view patients summary');
    }

    if (!userId) {
      return { accessiblePatientsCount: 0 };
    }

    if (userRole === ProfessionalRole.ADMIN || userRole === ProfessionalRole.SECRETARY) {
      if (!activeClinicId) {
        return { accessiblePatientsCount: 0 };
      }

      const patientIds = await this.getClinicPatientIds(activeClinicId);
      return {
        accessiblePatientsCount: patientIds.length,
      };
    }

    const patientIds = await this.getAccessiblePatientIdsForDoctor(userId);

    return {
      accessiblePatientsCount: patientIds.length,
    };
  }

  async findMyPatients(
    userType: string,
    userId?: string,
    userRole?: string | null,
    activeClinicId?: string | null,
  ) {
    if (userType !== 'doctor') {
      throw new ForbiddenException('Only professionals can view patients');
    }

    if (!userId) {
      return [];
    }

    let patientIds: string[] = [];

    if (userRole === ProfessionalRole.ADMIN || userRole === ProfessionalRole.SECRETARY) {
      if (!activeClinicId) {
        return [];
      }
      patientIds = await this.getClinicPatientIds(activeClinicId);
    } else {
      patientIds = await this.getAccessiblePatientIdsForDoctor(userId);
    }

    if (patientIds.length === 0) {
      return [];
    }

    const patients = await this.patientRepository.find({
      where: { id: In(patientIds) },
      select: this.patientSelectFields,
    });

    return patients.map((patient) => ({
      ...patient,
      createdByDoctorId: patient.doctorCreatorId,
      hasPermission: userRole === ProfessionalRole.SECRETARY ? false : true,
      hasAccess: userRole === ProfessionalRole.SECRETARY ? false : true,
    }));
  }

  async findAll(
    userType: string,
    userId?: string,
    userRole?: string | null,
    activeClinicId?: string | null,
  ) {
    if (userType !== 'doctor') {
      throw new ForbiddenException('Only professionals can view patients');
    }

    if (userRole === ProfessionalRole.ADMIN || userRole === ProfessionalRole.SECRETARY) {
      if (!activeClinicId) {
        return [];
      }

      const patientIds = await this.getClinicPatientIds(activeClinicId);
      if (patientIds.length === 0) {
        return [];
      }

      const patients = await this.patientRepository.find({
        where: { id: In(patientIds) },
        select: this.patientSelectFields,
      });

      return patients.map((patient) => ({
        ...patient,
        createdByDoctorId: patient.doctorCreatorId,
        hasPermission: userRole === ProfessionalRole.SECRETARY ? false : true,
        hasAccess: userRole === ProfessionalRole.SECRETARY ? false : true,
      }));
    }

    const patients = await this.patientRepository.find({
      select: this.patientSelectFields,
    });

    if (!userId || patients.length === 0) {
      return patients.map((patient) => ({
        ...patient,
        createdByDoctorId: patient.doctorCreatorId,
        hasPermission: false,
        hasAccess: false,
      }));
    }

    const patientIds = patients.map((patient) => patient.id);
    const permissions = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('permission.patientId', 'patientId')
      .where('permission.doctorId = :doctorId', { doctorId: userId })
      .andWhere('permission.isActive = :isActive', { isActive: true })
      .andWhere('permission.patientId IN (:...patientIds)', { patientIds })
      .getRawMany<{ patientId: string }>();

    const patientIdsWithPermission = new Set(permissions.map((p) => p.patientId));

    return patients.map((patient) => {
      const isCreator = patient.doctorCreatorId === userId;
      const hasPermission = isCreator || patientIdsWithPermission.has(patient.id);
      return {
        ...patient,
        createdByDoctorId: patient.doctorCreatorId,
        hasPermission,
        hasAccess: hasPermission,
      };
    });
  }

  async findOne(
    id: string,
    userId: string,
    userType: string,
    userRole?: string | null,
    activeClinicId?: string | null,
  ) {
    const patient = await this.patientRepository.findOne({
      where: { id },
      select: [
        'id',
        'name',
        'email',
        'gender',
        'phone',
        'birthDate',
        'profileImage',
        'type',
        'isShadow',
        'doctorCreatorId',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    if (userType === 'patient' && patient.id !== userId) {
      throw new ForbiddenException('You can only view your own profile');
    }

    if (userType === 'doctor' && userId) {
      if (userRole === ProfessionalRole.SECRETARY) {
        throw new ForbiddenException('Secretary cannot access patient profile details');
      }

      if (userRole === ProfessionalRole.ADMIN) {
        if (!activeClinicId) {
          throw new ForbiddenException('No active clinic context found');
        }

        const clinicPatientIds = await this.getClinicPatientIds(activeClinicId);
        if (!clinicPatientIds.includes(id)) {
          throw new ForbiddenException('Patient does not belong to current clinic scope');
        }

        return {
          ...patient,
          createdByDoctorId: patient.doctorCreatorId,
          hasPermission: true,
          hasAccess: true,
        };
      }

      const isCreator = patient.doctorCreatorId === userId;
      let hasPermission = isCreator;

      if (!isCreator) {
        const permission = await this.permissionRepository.findOne({
          where: { doctorId: userId, patientId: id, isActive: true },
        });
        hasPermission = !!permission;
      }

      if (!hasPermission) {
        throw new ForbiddenException('You do not have permission to view this patient');
      }

      return {
        ...patient,
        createdByDoctorId: patient.doctorCreatorId,
        hasPermission,
        hasAccess: hasPermission,
      };
    }

    return patient;
  }

  async search(
    query: string,
    userType: string,
    userId?: string,
    userRole?: string | null,
    activeClinicId?: string | null,
  ) {
    if (userType !== 'doctor') {
      throw new ForbiddenException('Only professionals can search patients');
    }

    if (query.length < 3) {
      throw new ForbiddenException('Search query must be at least 3 characters');
    }

    const patients = await this.patientRepository.find({
      where: [{ name: Like(`%${query}%`) }, { email: Like(`%${query}%`) }],
      select: this.patientSelectFields,
    });

    if (!userId || patients.length === 0) {
      return patients.map((patient) => ({
        ...patient,
        createdByDoctorId: patient.doctorCreatorId,
        hasPermission: false,
        hasAccess: false,
      }));
    }

    if (userRole === ProfessionalRole.SECRETARY) {
      return patients.map((patient) => ({
        ...patient,
        createdByDoctorId: patient.doctorCreatorId,
        hasPermission: false,
        hasAccess: false,
      }));
    }

    if (userRole === ProfessionalRole.ADMIN) {
      if (!activeClinicId) {
        return [];
      }

      const clinicPatientIds = await this.getClinicPatientIds(activeClinicId);
      const clinicPatientSet = new Set(clinicPatientIds);

      return patients.map((patient) => {
        const hasAccess = clinicPatientSet.has(patient.id);
        return {
          ...patient,
          createdByDoctorId: patient.doctorCreatorId,
          hasPermission: hasAccess,
          hasAccess,
        };
      });
    }

    const patientIds = patients.map((patient) => patient.id);
    const permissions = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('permission.patientId', 'patientId')
      .where('permission.doctorId = :doctorId', { doctorId: userId })
      .andWhere('permission.isActive = :isActive', { isActive: true })
      .andWhere('permission.patientId IN (:...patientIds)', { patientIds })
      .getRawMany<{ patientId: string }>();

    const patientIdsWithPermission = new Set(permissions.map((p) => p.patientId));

    return patients.map((patient) => {
      const isCreator = patient.doctorCreatorId === userId;
      const hasPermission = isCreator || patientIdsWithPermission.has(patient.id);
      return {
        ...patient,
        createdByDoctorId: patient.doctorCreatorId,
        hasPermission,
        hasAccess: hasPermission,
      };
    });
  }
}
