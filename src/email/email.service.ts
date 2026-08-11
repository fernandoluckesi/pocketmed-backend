import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailEnabled: boolean;
  private readonly emailMockFallback: boolean;
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const nodeEnv = String(this.configService.get<string>('NODE_ENV') ?? 'development').trim();
    const enabledDefault = nodeEnv === 'development' ? 'false' : 'true';
    const enabledFlag = String(this.configService.get<string>('EMAIL_ENABLED') ?? enabledDefault).trim();
    this.emailEnabled = enabledFlag.toLowerCase() !== 'false';

    const mockFallbackDefault = nodeEnv === 'development' ? 'true' : 'false';
    const mockFallbackFlag = String(
      this.configService.get<string>('EMAIL_MOCK_FALLBACK') ?? mockFallbackDefault,
    ).trim();
    this.emailMockFallback = mockFallbackFlag.toLowerCase() !== 'false';

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });

    if (!this.emailEnabled) {
      this.logger.warn(
        'Email sending is disabled by EMAIL_ENABLED=false. Verification/reset codes will be logged only.',
      );
    }

    if (this.emailMockFallback) {
      this.logger.warn(
        'Email mock fallback is enabled (EMAIL_MOCK_FALLBACK=true). SMTP errors will fallback to log-only mode.',
      );
    }
  }

  private ensureEmailEnabledOrLogFallback(email: string, code: string, purpose: string) {
    if (this.emailEnabled) {
      return true;
    }

    this.logger.warn(
      `[EMAIL_DISABLED] ${purpose} code for ${email}: ${code}. No email was sent because EMAIL_ENABLED=false.`,
    );
    return false;
  }

  private shouldUseMockFallback(error: any): boolean {
    if (!this.emailMockFallback) {
      return false;
    }

    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || '').toLowerCase();

    return (
      code === 'EAUTH' ||
      code === 'ECONNECTION' ||
      code === 'ETIMEDOUT' ||
      message.includes('invalid login') ||
      message.includes('badcredentials') ||
      message.includes('username and password not accepted')
    );
  }

  private logMockCode(email: string, code: string, purpose: string) {
    this.logger.warn(
      `[EMAIL_MOCK] ${purpose} code for ${email}: ${code}. Delivery mocked due to SMTP fallback.`,
    );
  }

  private rethrowEmailError(error: any, context: string) {
    const errorMessage = error?.message || 'Unknown email transport error';
    this.logger.error(`${context}: ${errorMessage}`);

    throw new ServiceUnavailableException(
      'Falha ao enviar e-mail. Verifique EMAIL_USER/EMAIL_PASSWORD (no Gmail use App Password) ou desative envio com EMAIL_ENABLED=false no ambiente local.',
    );
  }

  async sendVerificationCode(email: string, code: string, userName: string) {
    try {
      if (!this.ensureEmailEnabledOrLogFallback(email, code, 'Verification')) {
        return;
      }

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
      if (this.shouldUseMockFallback(error)) {
        this.logger.warn(`Falling back to mock verification email delivery for ${email}.`);
        this.logMockCode(email, code, 'Verification');
        return;
      }
      this.rethrowEmailError(error, 'Error sending verification email');
    }
  }

  async sendEmailVerificationCode(email: string, code: string, userName: string) {
    try {
      if (!this.ensureEmailEnabledOrLogFallback(email, code, 'Email verification')) {
        return;
      }

      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to: email,
        subject: 'Verificação de Email - PocketMed',
        html: `
          <h1>Olá, ${userName}!</h1>
          <p>Bem-vindo(a) ao PocketMed!</p>
          <p>Seu código de verificação é: <strong>${code}</strong></p>
          <p>Este código expira em 15 minutos.</p>
          <p>Se você não criou uma conta no PocketMed, ignore este email.</p>
          <br>
          <p>Atenciosamente,</p>
          <p>Equipe PocketMed</p>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email verification code sent to ${email}`);
    } catch (error) {
      if (this.shouldUseMockFallback(error)) {
        this.logger.warn(`Falling back to mock email verification delivery for ${email}.`);
        this.logMockCode(email, code, 'Email verification');
        return;
      }
      this.rethrowEmailError(error, 'Error sending email verification');
    }
  }

  async sendPasswordResetCode(email: string, code: string, userName: string) {
    try {
      if (!this.ensureEmailEnabledOrLogFallback(email, code, 'Password reset')) {
        return;
      }

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
      if (this.shouldUseMockFallback(error)) {
        this.logger.warn(`Falling back to mock password reset email delivery for ${email}.`);
        this.logMockCode(email, code, 'Password reset');
        return;
      }
      this.rethrowEmailError(error, 'Error sending password reset email');
    }
  }
}
