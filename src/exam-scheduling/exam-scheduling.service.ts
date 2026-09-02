import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamSchedule, ExamScheduleStatus } from '../entities/exam-schedule.entity';
import { ExamScheduleItem } from '../entities/exam-schedule-item.entity';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class ExamSchedulingService {
  constructor(
    @InjectRepository(ExamSchedule)
    private examScheduleRepository: Repository<ExamSchedule>,
    @InjectRepository(ExamScheduleItem)
    private examScheduleItemRepository: Repository<ExamScheduleItem>,
    private readonly uploadService: UploadService,
  ) {}

  async create(patientId: string, dto: CreateExamScheduleDto): Promise<ExamSchedule> {
    if (!dto.exams || dto.exams.length === 0) {
      throw new BadRequestException(
        'A lista de exames não pode estar vazia. Selecione pelo menos um exame.',
      );
    }

    const scheduledDateTime = new Date(dto.scheduledDateTime);
    if (scheduledDateTime <= new Date()) {
      throw new BadRequestException(
        'A data e horário do agendamento não podem estar no passado.',
      );
    }

    const schedule = this.examScheduleRepository.create({
      patientId,
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
      relations: ['items', 'items.examCatalog', 'items.examCatalog.category'],
    });
  }

  async findAllByPatient(patientId: string): Promise<ExamSchedule[]> {
    return this.examScheduleRepository.find({
      where: { patientId },
      relations: ['items', 'items.examCatalog', 'items.examCatalog.category'],
      order: { scheduledDateTime: 'ASC' },
    });
  }

  async findOneByPatient(id: string, patientId: string): Promise<ExamSchedule | null> {
    return this.examScheduleRepository.findOne({
      where: { id, patientId },
      relations: ['items', 'items.examCatalog', 'items.examCatalog.category'],
    });
  }

  async update(
    id: string,
    patientId: string,
    data: {
      status?: string;
      scheduledDateTime?: string;
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
