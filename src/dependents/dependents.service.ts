import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dependent } from '../entities/dependent.entity';
import { Patient } from '../entities/patient.entity';
import { UploadService } from '../upload/upload.service';
import { CreateDependentDto } from './dto/create-dependent.dto';

@Injectable()
export class DependentsService {
  constructor(
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    private uploadService: UploadService,
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
