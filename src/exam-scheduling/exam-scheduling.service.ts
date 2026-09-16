import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ExamSchedule, ExamScheduleStatus } from '../entities/exam-schedule.entity';
import { ExamScheduleItem } from '../entities/exam-schedule-item.entity';
import { Dependent } from '../entities/dependent.entity';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { UploadService } from '../upload/upload.service';

const SCHEDULE_RELATIONS = [
  'items',
  'items.examCatalog',
  'items.examCatalog.category',
];

@Injectable()
export class ExamSchedulingService {
  constructor(
    @InjectRepository(ExamSchedule)
    private examScheduleRepository: Repository<ExamSchedule>,
    @InjectRepository(ExamScheduleItem)
    private examScheduleItemRepository: Repository<ExamScheduleItem>,
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    private readonly uploadService: UploadService,
  ) {}

  /** IDs of the dependents the given patient is responsible for. */
  private async getDependentIds(patientId: string): Promise<string[]> {
    const dependents = await this.dependentRepository
      .createQueryBuilder('dependent')
      .leftJoin('dependent.responsibles', 'responsible')
      .where('responsible.id = :patientId', { patientId })
      .getMany();
    return dependents.map((d) => d.id);
  }

  /** Ensure the patient is a responsible for the dependent, or throw. */
  private async assertDependentAccess(
    patientId: string,
    dependentId: string,
  ): Promise<void> {
    const dependentIds = await this.getDependentIds(patientId);
    if (!dependentIds.includes(dependentId)) {
      throw new ForbiddenException(
        'Você não tem permissão para gerenciar agendamentos deste dependente.',
      );
    }
  }

  async create(patientId: string, dto: CreateExamScheduleDto): Promise<ExamSchedule> {
    if (!dto.exams || dto.exams.length === 0) {
      throw new BadRequestException(
        'A lista de exames não pode estar vazia. Selecione pelo menos um exame.',
      );
    }

    // Date/time is optional (e.g. an exam prescribed during a consultation is
    // not scheduled yet). Only validate "not in the past" when it is provided.
    let scheduledDateTime: Date | null = null;
    if (dto.scheduledDateTime) {
      scheduledDateTime = new Date(dto.scheduledDateTime);
      if (scheduledDateTime <= new Date()) {
        throw new BadRequestException(
          'A data e horário do agendamento não podem estar no passado.',
        );
      }
    }

    // When scheduling for a dependent, verify the caller is a responsible.
    if (dto.dependentId) {
      await this.assertDependentAccess(patientId, dto.dependentId);
    }

    const schedule = this.examScheduleRepository.create({
      patientId,
      dependentId: dto.dependentId ?? null,
      appointmentId: dto.appointmentId ?? null,
      scheduledDateTime,
      status: ExamScheduleStatus.PENDING,
    });

    const savedSchedule = await this.examScheduleRepository.save(schedule);

    const items = dto.exams.map((examItem) =>
      this.examScheduleItemRepository.create({
        examScheduleId: savedSchedule.id,
        examCatalogId: examItem.examCatalogId ?? null,
        customExamName: examItem.customExamName ?? null,
      }),
    );

    await this.examScheduleItemRepository.save(items);

    return this.examScheduleRepository.findOne({
      where: { id: savedSchedule.id },
      relations: SCHEDULE_RELATIONS,
    });
  }

  /** Schedules linked to a given appointment, owned by the patient. */
  async findByAppointment(
    appointmentId: string,
    patientId: string,
  ): Promise<ExamSchedule[]> {
    const dependentIds = await this.getDependentIds(patientId);
    const where: any[] = [{ appointmentId, patientId, dependentId: IsNull() }];
    if (dependentIds.length > 0) {
      where.push({ appointmentId, dependentId: In(dependentIds) });
    }
    return this.examScheduleRepository.find({
      where,
      relations: SCHEDULE_RELATIONS,
      order: { createdAt: 'ASC' },
    });
  }

  async findAllByPatient(patientId: string): Promise<ExamSchedule[]> {
    const dependentIds = await this.getDependentIds(patientId);

    // The patient's own schedules (dependentId = NULL) plus their dependents'.
    const where: any[] = [{ patientId, dependentId: IsNull() }];
    if (dependentIds.length > 0) {
      where.push({ dependentId: In(dependentIds) });
    }

    return this.examScheduleRepository.find({
      where,
      relations: SCHEDULE_RELATIONS,
      order: { scheduledDateTime: 'ASC' },
    });
  }

  /**
   * Finds a schedule and authorizes the caller: allowed when it's the patient's
   * own schedule OR it belongs to a dependent the patient is responsible for.
   */
  async findOneByPatient(id: string, patientId: string): Promise<ExamSchedule | null> {
    const schedule = await this.examScheduleRepository.findOne({
      where: { id },
      relations: SCHEDULE_RELATIONS,
    });
    if (!schedule) {
      return null;
    }

    const isOwn = schedule.patientId === patientId && !schedule.dependentId;
    if (isOwn) {
      return schedule;
    }

    if (schedule.dependentId) {
      const dependentIds = await this.getDependentIds(patientId);
      if (dependentIds.includes(schedule.dependentId)) {
        return schedule;
      }
    }

    return null;
  }

  async update(
    id: string,
    patientId: string,
    data: {
      status?: string;
      scheduledDateTime?: string;
      appointmentId?: string;
      exams?: { examCatalogId?: string | null; customExamName?: string | null }[];
    },
  ): Promise<ExamSchedule> {
    const schedule = await this.findOneByPatient(id, patientId);
    if (!schedule) {
      throw new BadRequestException('Agendamento não encontrado.');
    }
    if (data.status) {
      (schedule as any).status = data.status;
    }
    if (data.scheduledDateTime) {
      schedule.scheduledDateTime = new Date(data.scheduledDateTime);
    }
    if (data.appointmentId !== undefined) {
      schedule.appointmentId = data.appointmentId;
    }
    await this.examScheduleRepository.save(schedule);

    // Replace items if a new exam list was provided (used by the edit flow)
    if (data.exams && data.exams.length > 0) {
      await this.examScheduleItemRepository.delete({ examScheduleId: id });
      const items = data.exams.map((examItem) =>
        this.examScheduleItemRepository.create({
          examScheduleId: id,
          examCatalogId: examItem.examCatalogId ?? null,
          customExamName: examItem.customExamName ?? null,
        }),
      );
      await this.examScheduleItemRepository.save(items);
    }

    return this.findOneByPatient(id, patientId);
  }

  async saveResult(
    id: string,
    patientId: string,
    data: { resultText?: string | null },
    file?: Express.Multer.File,
  ): Promise<ExamSchedule> {
    const schedule = await this.findOneByPatient(id, patientId);
    if (!schedule) {
      throw new BadRequestException('Agendamento não encontrado.');
    }

    if (file) {
      schedule.resultFileUrl = await this.uploadService.uploadFile(file, 'exam-results');
    }
    if (data.resultText !== undefined) {
      schedule.resultText = data.resultText || null;
    }
    schedule.status = ExamScheduleStatus.CONFIRMED;

    await this.examScheduleRepository.save(schedule);
    return this.findOneByPatient(id, patientId);
  }

  async remove(id: string, patientId: string): Promise<void> {
    const schedule = await this.findOneByPatient(id, patientId);
    if (!schedule) {
      throw new BadRequestException('Agendamento não encontrado.');
    }
    await this.examScheduleItemRepository.delete({ examScheduleId: id });
    await this.examScheduleRepository.delete({ id });
  }
}
