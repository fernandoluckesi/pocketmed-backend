import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    private emailService: EmailService,
  ) {}

  /**
   * Resolves the sender's name/email from the authenticated user and forwards
   * the message to the support inbox via email (Resend), with the user set as
   * reply-to.
   */
  async sendMessage(
    user: { userId: string; email?: string; type?: string },
    message: string,
  ): Promise<{ message: string }> {
    let name = '';
    let email = user.email ?? '';

    if (user.type === 'doctor') {
      const doctor = await this.doctorRepository.findOne({ where: { id: user.userId } });
      name = doctor?.name ?? '';
      email = email || (doctor?.email ?? '');
    } else {
      const patient = await this.patientRepository.findOne({ where: { id: user.userId } });
      name = patient?.name ?? '';
      email = email || (patient?.email ?? '');
    }

    await this.emailService.sendSupportMessage({
      userName: name || 'Usuário Hispora',
      userEmail: email,
      userType: user.type,
      message,
    });

    return { message: 'Mensagem enviada para o suporte com sucesso.' };
  }
}
