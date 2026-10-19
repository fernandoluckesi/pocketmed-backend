import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Prescription } from '../entities/prescription.entity';
import { ExamRequest } from '../entities/exam-request.entity';
import { EmailService } from '../email/email.service';
import { DocumentAccessTokenService, DocumentAccessKind } from '../documents/document-access-token.service';
import { DOCUMENT_FOLDERS } from '../documents/document.types';

/** Receita/guia links need to stay useful long enough for someone to go to
 * the pharmacy/lab days or weeks later — unlike the short-lived links used
 * for in-app viewing (see upload.service.ts / document-access.service.ts). */
const DOCUMENT_LINK_EXPIRY = '90d';

/**
 * Sends the end-of-consultation email with links to that visit's
 * prescriptions and exam requests — the only delivery channel that reaches a
 * shadow patient (no app account, so no push notification is possible), and
 * sent to every patient (shadow or not) since email doesn't depend on the
 * app being installed. See archives/docs-regras-de-negocio for the full
 * business rules this implements.
 */
@Injectable()
export class ConsultationSummaryEmailService {
  private readonly logger = new Logger(ConsultationSummaryEmailService.name);
  private readonly apiUrl: string;

  constructor(
    @InjectRepository(Prescription) private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(ExamRequest) private readonly examRequestRepo: Repository<ExamRequest>,
    private readonly emailService: EmailService,
    private readonly tokenService: DocumentAccessTokenService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = (
      this.configService.get<string>('API_PUBLIC_URL') ||
      'https://pocketmed-backend-production.up.railway.app'
    ).replace(/\/+$/, '');
  }

  /**
   * Best-effort by design: a failure here must never break the consultation
   * save that triggered it. Every error is caught and logged, never rethrown.
   */
  async notifyIfApplicable(opts: {
    appointmentId: string;
    patientEmail: string | null;
    patientName: string;
    doctorName: string;
    appointmentDate: Date;
  }): Promise<void> {
    if (!opts.patientEmail) return;

    try {
      const [prescriptions, examRequests] = await Promise.all([
        this.prescriptionRepo.find({ where: { appointmentId: opts.appointmentId } }),
        this.examRequestRepo.find({ where: { appointmentId: opts.appointmentId } }),
      ]);

      const documents = [
        ...prescriptions
          .filter((p) => !!p.documentUrl)
          .map((p) => ({
            label: 'Receita médica',
            url: this.buildAccessUrl(DOCUMENT_FOLDERS.prescriptions, p.id),
          })),
        ...examRequests
          .filter((e) => !!e.documentUrl)
          .map((e) => ({
            label: 'Guia de exame',
            url: this.buildAccessUrl(DOCUMENT_FOLDERS.examRequests, e.id),
          })),
      ];

      // Nothing generated yet for this visit (e.g. doctor only wrote notes) -
      // nothing worth emailing about via this specific channel.
      if (documents.length === 0) return;

      await this.emailService.sendConsultationSummaryEmail(
        opts.patientEmail,
        opts.patientName,
        opts.doctorName,
        opts.appointmentDate,
        documents,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send consultation summary email for appointment ${opts.appointmentId}: ${error.message}`,
      );
    }
  }

  private buildAccessUrl(kind: DocumentAccessKind, recordId: string): string {
    const token = this.tokenService.sign(kind, recordId, DOCUMENT_LINK_EXPIRY);
    return `${this.apiUrl}/documents/access/${token}`;
  }
}
