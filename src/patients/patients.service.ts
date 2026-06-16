import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { DoctorPermission } from '../entities/doctor-permission.entity';
import { ClinicMembership } from '../entities/clinic-membership.entity';
import { Appointment } from '../entities/appointment.entity';
import { Medication } from '../entities/medication.entity';
import { Exam } from '../entities/exam.entity';
import { PatientAccessLog } from '../entities/patient-access-log.entity';
import { ProfessionalRole } from '../auth/professional-role.enum';
import { NotificationsService } from '../notifications/notifications.service';

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
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Medication)
    private medicationRepository: Repository<Medication>,
    @InjectRepository(Exam)
    private examRepository: Repository<Exam>,
    @InjectRepository(PatientAccessLog)
    private accessLogRepository: Repository<PatientAccessLog>,
    private notificationsService: NotificationsService,
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

  private async logAccess(patientId: string, accessedBy: string, action: string, details?: string) {
    const log = this.accessLogRepository.create({
      patientId,
      accessedBy,
      action,
      details: details || null,
    });
    await this.accessLogRepository.save(log);
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
    if (userType !== 'doctor' || userRole !== ProfessionalRole.DOCTOR) {
      throw new ForbiddenException('Only doctors can view patients');
    }

    if (!userId) {
      return [];
    }

    const patientIds = await this.getAccessiblePatientIdsForDoctor(userId);

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
      hasPermission: true,
      hasAccess: true,
    }));
  }

  async findAll(
    userType: string,
    userId?: string,
    userRole?: string | null,
    activeClinicId?: string | null,
  ) {
    if (userType !== 'doctor' || userRole !== ProfessionalRole.DOCTOR) {
      throw new ForbiddenException('Only doctors can view all patients');
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
      if (userRole !== ProfessionalRole.DOCTOR) {
        throw new ForbiddenException('Only doctors can access patient profile details');
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

    if (userRole === ProfessionalRole.SECRETARY || userRole === ProfessionalRole.ADMIN) {
      if (!activeClinicId) {
        throw new ForbiddenException('Active clinic context is required to search patients');
      }

      const clinicPatientIds = await this.getClinicPatientIds(activeClinicId);
      if (clinicPatientIds.length === 0) {
        return [];
      }

      const patients = await this.patientRepository.find({
        where: [
          { id: In(clinicPatientIds), name: Like(`%${query}%`) },
          { id: In(clinicPatientIds), email: Like(`%${query}%`) },
        ],
        select: ['id', 'name', 'email'],
      });

      return patients.map((patient) => ({
        id: patient.id,
        name: patient.name,
        email: patient.email,
      }));
    }

    if (userRole !== ProfessionalRole.DOCTOR) {
      throw new ForbiddenException('Only doctors can search patients');
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

  // ─── Sprint 1: Patient Medical Record & Sub-resources ───────────────────────

  async getMedicalRecord(
    patientId: string,
    doctorId: string,
    userType: string,
    role: string,
    activeClinicId: string,
  ) {
    // Verify access using existing findOne permission logic
    const patient = await this.findOne(patientId, doctorId, userType, role, activeClinicId);

    await this.logAccess(patientId, doctorId, 'VIEW_RECORD');

    // Get appointments
    let appointments = await this.appointmentRepository.find({
      where: { patientId },
      order: { dateTime: 'DESC' },
      take: 50,
    });

    // Filter out pending_approval consultations from other doctors (they can only see approved ones)
    if (userType === 'doctor') {
      appointments = appointments.filter(
        (apt) => apt.status !== ('pending_approval' as any) || apt.doctorId === doctorId,
      );
    }

    // Get medications
    const medications = await this.medicationRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });

    // Get exams
    const exams = await this.examRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });

    return { patient, appointments, medications, exams };
  }

  async getConsultations(
    patientId: string,
    doctorId: string,
    userType: string,
    role: string,
    activeClinicId: string,
    startDate?: string,
    endDate?: string,
  ) {
    // Verify access
    await this.findOne(patientId, doctorId, userType, role, activeClinicId);

    await this.logAccess(patientId, doctorId, 'VIEW_CONSULTATIONS');

    const where: any = { patientId };

    if (startDate && endDate) {
      where.dateTime = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.dateTime = MoreThanOrEqual(new Date(startDate));
    } else if (endDate) {
      where.dateTime = LessThanOrEqual(new Date(endDate));
    }

    const appointments = await this.appointmentRepository.find({
      where,
      order: { dateTime: 'DESC' },
    });

    return appointments;
  }

  async getMedications(
    patientId: string,
    doctorId: string,
    userType: string,
    role: string,
    activeClinicId: string,
  ) {
    // Verify access
    await this.findOne(patientId, doctorId, userType, role, activeClinicId);

    await this.logAccess(patientId, doctorId, 'VIEW_MEDICATIONS');

    const medications = await this.medicationRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });

    return medications;
  }

  async getExams(
    patientId: string,
    doctorId: string,
    userType: string,
    role: string,
    activeClinicId: string,
  ) {
    // Verify access
    await this.findOne(patientId, doctorId, userType, role, activeClinicId);

    await this.logAccess(patientId, doctorId, 'VIEW_EXAMS');

    const exams = await this.examRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });

    return exams;
  }

  async createConsultation(
    patientId: string,
    doctorId: string,
    userType: string,
    role: string,
    activeClinicId: string,
    data: {
      date: string;
      symptoms?: string;
      diagnosis?: string;
      prescription?: string;
      notes?: string;
      priority?: string;
      completed?: boolean;
    },
  ) {
    // Verify access
    const patient = await this.findOne(patientId, doctorId, userType, role, activeClinicId);

    await this.logAccess(patientId, doctorId, 'CREATE_CONSULTATION');

    const isCompleted = data.completed === true;

    // Shadow patients don't need approval (they don't have an app account)
    const patientEntity = await this.patientRepository.findOne({ where: { id: patientId } });
    const isShadow = patientEntity?.isShadow ?? false;

    // Shadow: goes directly to final status. Non-shadow: needs patient approval first
    let status: string;
    if (isShadow) {
      status = isCompleted ? 'completed' : 'approved';
    } else {
      status = 'pending_approval';
    }

    const appointment = this.appointmentRepository.create({
      patientId,
      doctorId,
      dateTime: new Date(data.date),
      reason: data.symptoms || '',
      doctorFeedback: data.diagnosis || null,
      doctorInstructions: data.prescription || null,
      status: status as any,
      isCompleted,
      lockedByDoctor: true,
      lastModifiedById: doctorId,
      lastModifiedByType: 'doctor',
      doctorCrm: '',
      doctorName: '',
      doctorSpecialty: '',
    });

    const saved = await this.appointmentRepository.save(appointment);

    // Send push notification to patient if not shadow
    if (!isShadow) {
      const doctorEntity = await this.patientRepository.manager
        .getRepository('Doctor')
        .findOne({ where: { id: doctorId }, select: ['id', 'name'] }) as { id: string; name: string } | null;

      const doctorName = doctorEntity?.name || 'Seu médico';
      const dateFormatted = new Date(data.date).toLocaleDateString('pt-BR');

      await this.notificationsService.createNotification(
        patientId,
        'patient',
        'Nova consulta agendada',
        `${doctorName} agendou uma consulta para ${dateFormatted}. Toque para confirmar.`,
        'CONSULTATION_APPROVAL_REQUESTED',
        { appointmentId: saved.id, doctorId, doctorName },
        saved.id,
      );
    }

    return saved;
  }

  async updateConsultation(
    patientId: string,
    consultationId: string,
    userId: string,
    userType: string,
    role: string,
    activeClinicId: string,
    data: {
      date?: string;
      symptoms?: string;
      diagnosis?: string;
      prescription?: string;
      notes?: string;
      completed?: boolean;
    },
  ) {
    // Verify access
    await this.findOne(patientId, userId, userType, role, activeClinicId);

    await this.logAccess(patientId, userId, 'UPDATE_CONSULTATION');

    const appointment = await this.appointmentRepository.findOne({
      where: { id: consultationId, patientId },
    });

    if (!appointment) {
      throw new NotFoundException('Consultation not found');
    }

    // If patient tries to edit a doctor-locked consultation, deny
    if (userType === 'patient' && appointment.lockedByDoctor) {
      throw new ForbiddenException('Esta consulta foi registrada pelo médico e não pode ser alterada.');
    }

    if (data.date) appointment.dateTime = new Date(data.date);
    if (data.symptoms !== undefined) appointment.reason = data.symptoms;
    if (data.diagnosis !== undefined) appointment.doctorFeedback = data.diagnosis || null;
    if (data.prescription !== undefined) {
      appointment.doctorInstructions = data.prescription || null;
    }
    if (data.completed !== undefined) {
      appointment.isCompleted = data.completed;
      appointment.status = (data.completed ? 'completed' : 'approved') as any;
    }

    // Track who modified
    appointment.lastModifiedById = userId;
    appointment.lastModifiedByType = userType === 'doctor' ? 'doctor' : 'patient';

    // If doctor edits, lock for patient and send notification
    if (userType === 'doctor') {
      appointment.lockedByDoctor = true;

      // Set status back to pending_approval if patient is not shadow
      const patientEntity = await this.patientRepository.findOne({ where: { id: patientId } });
      if (patientEntity && !patientEntity.isShadow) {
        appointment.status = 'pending_approval' as any;

        const doctorEntity = await this.patientRepository.manager
          .getRepository('Doctor')
          .findOne({ where: { id: userId }, select: ['id', 'name'] }) as { id: string; name: string } | null;

        const doctorName = doctorEntity?.name || 'Seu médico';

        await this.notificationsService.createNotification(
          patientId,
          'patient',
          'Consulta atualizada',
          `${doctorName} atualizou os dados da sua consulta. Toque para revisar e confirmar.`,
          'CONSULTATION_APPROVAL_REQUESTED',
          { appointmentId: consultationId, doctorId: userId, doctorName },
          consultationId,
        );
      }
    }

    return this.appointmentRepository.save(appointment);
  }

  async approveConsultation(
    patientId: string,
    consultationId: string,
    userId: string,
    approved: boolean,
  ) {
    // Only the patient themselves can approve
    if (userId !== patientId) {
      throw new ForbiddenException('Only the patient can approve/reject consultations');
    }

    const appointment = await this.appointmentRepository.findOne({
      where: { id: consultationId, patientId },
    });

    if (!appointment) {
      throw new NotFoundException('Consultation not found');
    }

    if (appointment.status !== ('pending_approval' as any)) {
      throw new ForbiddenException('This consultation is not pending approval');
    }

    appointment.status = (approved ? (appointment.isCompleted ? 'completed' : 'approved') : 'rejected') as any;

    const saved = await this.appointmentRepository.save(appointment);

    // Notify the doctor about the decision
    const patientEntity = await this.patientRepository.findOne({ where: { id: patientId }, select: ['id', 'name'] });
    const patientName = patientEntity?.name || 'Paciente';

    await this.notificationsService.createNotification(
      appointment.doctorId,
      'doctor',
      approved ? 'Consulta confirmada' : 'Consulta recusada',
      approved
        ? `${patientName} confirmou a consulta agendada.`
        : `${patientName} recusou a consulta agendada.`,
      approved ? 'CONSULTATION_APPROVED' : 'CONSULTATION_REJECTED',
      { appointmentId: saved.id, patientId },
      saved.id,
    );

    return saved;
  }

  async prescribeMedication(
    patientId: string,
    doctorId: string,
    userType: string,
    role: string,
    activeClinicId: string,
    data: {
      name: string;
      dosage: string;
      frequency: string;
      type?: string;
      startDate: string;
      endDate?: string;
      notes?: string;
    },
  ) {
    // Verify access
    await this.findOne(patientId, doctorId, userType, role, activeClinicId);

    await this.logAccess(patientId, doctorId, 'PRESCRIBE_MEDICATION');

    const medication = this.medicationRepository.create({
      patientId,
      doctorId,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency as any,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      instructions: data.notes || null,
      isActive: true,
    });

    const saved = await this.medicationRepository.save(medication);
    return saved;
  }

  async updatePatient(
    patientId: string,
    userId: string,
    userType: string,
    role: string,
    activeClinicId: string,
    data: {
      name?: string;
      phone?: string;
      gender?: string;
      birthDate?: string;
      profileImage?: string;
    },
  ) {
    // Verify access — own patient or admin
    const patient = await this.findOne(patientId, userId, userType, role, activeClinicId);

    await this.logAccess(patientId, userId, 'UPDATE_PATIENT');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.birthDate !== undefined) updateData.birthDate = data.birthDate;
    if (data.profileImage !== undefined) updateData.profileImage = data.profileImage;

    if (Object.keys(updateData).length === 0) {
      return patient;
    }

    await this.patientRepository.update(patientId, updateData);

    return this.findOne(patientId, userId, userType, role, activeClinicId);
  }

  // ─── Sprint 3: Timeline & Alerts ───────────────────────────────────────────

  async getTimeline(
    patientId: string,
    doctorId: string,
    userType: string,
    role: string,
    activeClinicId: string,
    limit = 50,
  ) {
    // Verify access
    await this.findOne(patientId, doctorId, userType, role, activeClinicId);

    // Fetch all events
    const [appointments, medications, exams] = await Promise.all([
      this.appointmentRepository.find({ where: { patientId }, order: { dateTime: 'DESC' }, take: limit }),
      this.medicationRepository.find({ where: { patientId }, order: { createdAt: 'DESC' }, take: limit }),
      this.examRepository.find({ where: { patientId }, order: { createdAt: 'DESC' }, take: limit }),
    ]);

    // Build unified timeline
    const timeline: Array<{ type: string; date: string; title: string; description: string; data: any }> = [];

    for (const apt of appointments) {
      timeline.push({
        type: 'CONSULTA',
        date: apt.dateTime?.toISOString() || apt.createdAt?.toISOString(),
        title: apt.reason || 'Consulta',
        description: apt.doctorFeedback || apt.doctorInstructions || '',
        data: apt,
      });
    }

    for (const med of medications) {
      timeline.push({
        type: 'MEDICAMENTO',
        date: med.createdAt?.toISOString(),
        title: `${med.name} ${med.dosage}`,
        description: `${med.frequency} - ${med.isActive ? 'Ativo' : 'Descontinuado'}`,
        data: med,
      });
    }

    for (const exam of exams) {
      timeline.push({
        type: 'EXAME',
        date: exam.createdAt?.toISOString(),
        title: exam.name || 'Exame',
        description: exam.results || 'Resultado pendente',
        data: exam,
      });
    }

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return timeline.slice(0, limit);
  }

  async getAlerts(
    patientId: string,
    doctorId: string,
    userType: string,
    role: string,
    activeClinicId: string,
  ) {
    // Verify access
    const patient = await this.findOne(patientId, doctorId, userType, role, activeClinicId);

    const alerts: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    // Check for overdue medications (active medications with endDate in the past)
    const medications = await this.medicationRepository.find({
      where: { patientId, isActive: true },
    });

    const now = new Date();
    for (const med of medications) {
      if (med.endDate && new Date(med.endDate) < now) {
        alerts.push({
          type: 'MEDICATION_EXPIRED',
          severity: 'WARNING',
          message: `Medicamento "${med.name}" com prazo vencido`,
          details: `Fim previsto: ${new Date(med.endDate).toLocaleDateString('pt-BR')}`,
        });
      }
    }

    // Check for no recent consultations (last consultation > 6 months ago)
    const lastAppointment = await this.appointmentRepository.findOne({
      where: { patientId },
      order: { dateTime: 'DESC' },
    });

    if (lastAppointment) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const aptDate = lastAppointment.dateTime ? new Date(lastAppointment.dateTime) : new Date(lastAppointment.createdAt);
      if (aptDate < sixMonthsAgo) {
        alerts.push({
          type: 'NO_RECENT_CONSULTATION',
          severity: 'INFO',
          message: 'Paciente sem consulta há mais de 6 meses',
          details: `Última consulta: ${aptDate.toLocaleDateString('pt-BR')}`,
        });
      }
    } else {
      alerts.push({
        type: 'NO_CONSULTATIONS',
        severity: 'INFO',
        message: 'Paciente sem registro de consultas',
      });
    }

    return { patient: { id: patient.id, name: patient.name }, alerts };
  }

  // ─── Sprint 4: Audit Logging ────────────────────────────────────────────────

  async getAccessLog(
    patientId: string,
    doctorId: string,
    userType: string,
    role: string,
    activeClinicId: string,
  ) {
    await this.findOne(patientId, doctorId, userType, role, activeClinicId);
    return this.accessLogRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
