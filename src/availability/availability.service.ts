import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AvailabilityRule } from '../entities/availability-rule.entity';
import {
  AvailabilityException,
  AvailabilityExceptionType,
} from '../entities/availability-exception.entity';
import { UpdateAvailabilityRuleDto } from './dto/update-availability-rule.dto';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(AvailabilityRule)
    private availabilityRuleRepository: Repository<AvailabilityRule>,
    @InjectRepository(AvailabilityException)
    private availabilityExceptionRepository: Repository<AvailabilityException>,
  ) {}

  private getDefaultWeekly() {
    return {
      monday: {
        enabled: true,
        intervals: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '17:00' },
        ],
      },
      tuesday: {
        enabled: true,
        intervals: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '17:00' },
        ],
      },
      wednesday: {
        enabled: true,
        intervals: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '17:00' },
        ],
      },
      thursday: {
        enabled: true,
        intervals: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '17:00' },
        ],
      },
      friday: {
        enabled: true,
        intervals: [
          { start: '09:00', end: '12:00' },
          { start: '13:00', end: '17:00' },
        ],
      },
      saturday: { enabled: false, intervals: [] },
      sunday: { enabled: false, intervals: [] },
    };
  }

  async getRules(doctorId: string) {
    const existing = await this.availabilityRuleRepository.find({ where: { doctorId } });

    if (existing.length > 0) {
      return existing;
    }

    const created = this.availabilityRuleRepository.create({
      doctorId,
      name: 'Regra padrão',
      weekly: this.getDefaultWeekly(),
      duration: 30,
      buffer: 0,
    });

    const saved = await this.availabilityRuleRepository.save(created);
    return [saved];
  }

  async updateRule(ruleId: string, doctorId: string, dto: UpdateAvailabilityRuleDto) {
    const rule = await this.availabilityRuleRepository.findOne({ where: { id: ruleId } });

    if (!rule) {
      throw new NotFoundException('Availability rule not found');
    }

    if (rule.doctorId !== doctorId) {
      throw new ForbiddenException('You can only update your own availability rule');
    }

    if (dto.duration !== undefined && dto.duration < 1) {
      throw new BadRequestException('Duration must be at least 1 minute');
    }

    if (dto.buffer !== undefined && dto.buffer < 0) {
      throw new BadRequestException('Buffer cannot be negative');
    }

    Object.assign(rule, {
      name: dto.name !== undefined ? dto.name : rule.name,
      weekly: dto.weekly !== undefined ? dto.weekly : rule.weekly,
      duration: dto.duration !== undefined ? dto.duration : rule.duration,
      buffer: dto.buffer !== undefined ? dto.buffer : rule.buffer,
    });

    return this.availabilityRuleRepository.save(rule);
  }

  async getExceptions(doctorId: string) {
    return this.availabilityExceptionRepository.find({
      where: { doctorId },
      order: { createdAt: 'DESC' },
    });
  }

  async createException(doctorId: string, dto: CreateAvailabilityExceptionDto) {
    const type = dto.type || AvailabilityExceptionType.SINGLE;

    if (type === AvailabilityExceptionType.SINGLE && !dto.date) {
      throw new BadRequestException('date is required for single exception type');
    }

    if (type === AvailabilityExceptionType.RANGE && (!dto.startDate || !dto.endDate)) {
      throw new BadRequestException('startDate and endDate are required for range exception type');
    }

    const entity = this.availabilityExceptionRepository.create({
      doctorId,
      type,
      date: dto.date,
      startDate: dto.startDate,
      endDate: dto.endDate,
      fullDay: dto.fullDay ?? true,
      startTime: dto.startTime,
      endTime: dto.endTime,
      reason: dto.reason,
    });

    return this.availabilityExceptionRepository.save(entity);
  }

  async removeException(id: string, doctorId: string) {
    const exception = await this.availabilityExceptionRepository.findOne({ where: { id } });

    if (!exception) {
      throw new NotFoundException('Availability exception not found');
    }

    if (exception.doctorId !== doctorId) {
      throw new ForbiddenException('You can only remove your own availability exception');
    }

    await this.availabilityExceptionRepository.remove(exception);

    return { message: 'Availability exception removed successfully' };
  }
}
