import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
  }

  async sendVerificationCode(email: string, code: string, userName: string) {
    try {
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to: email,
        subject: 'Código de Verificação - PocketMed',
        html: `
          <h1>Olá, ${userName}!</h1>
          <p>Seu código de verificação é: <strong>${code}</strong></p>
          <p>Este código expira em 15 minutos.</p>
          <p>Se você não solicitou este código, ignore este email.</p>
          <br>
          <p>Atenciosamente,</p>
          <p>Equipe PocketMed</p>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification code sent to ${email}`);
    } catch (error) {
      this.logger.error(`Error sending verification email: ${error.message}`);
      throw error;
    }
  }

  async sendPasswordResetCode(email: string, code: string, userName: string) {
    try {
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to: email,
        subject: 'Recuperação de Senha - PocketMed',
        html: `
          <h1>Olá, ${userName}!</h1>
          <p>Você solicitou a recuperação de senha.</p>
          <p>Seu código de recuperação é: <strong>${code}</strong></p>
          <p>Este código expira em 15 minutos.</p>
          <p>Se você não solicitou a recuperação de senha, ignore este email.</p>
          <br>
          <p>Atenciosamente,</p>
          <p>Equipe PocketMed</p>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset code sent to ${email}`);
    } catch (error) {
      this.logger.error(`Error sending password reset email: ${error.message}`);
      throw error;
    }
  }
}
