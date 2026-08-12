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

  private buildEmailHtml(options: {
    userName: string;
    title: string;
    message: string;
    code: string;
    footer: string;
  }): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f7fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header with brand -->
          <tr>
            <td style="background: linear-gradient(135deg, #1B3FCC 0%, #2B5AED 100%);padding:32px 40px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:rgba(255,255,255,0.15);border-radius:12px;padding:10px 14px;">
                    <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Pocket</span><span style="font-size:24px;font-weight:800;color:#a8c4ff;letter-spacing:-0.5px;">Med</span>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.75);">Seu prontuário sempre com você</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 24px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a2e;">Olá, ${options.userName}!</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">${options.message}</p>
              <!-- Code box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:20px;background-color:#f0f4ff;border-radius:12px;border:1px dashed #1B3FCC40;">
                    <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${options.title}</p>
                    <p style="margin:0;font-size:36px;font-weight:800;color:#1B3FCC;letter-spacing:8px;font-family:'Courier New',monospace;">${options.code}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">⏱ Este código expira em <strong>15 minutos</strong>.</p>
              <p style="margin:8px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">${options.footer}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5;">
                Este é um email automático. Não responda.<br>
                © ${new Date().getFullYear()} PocketMed. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
        html: this.buildEmailHtml({
          userName,
          title: 'Código de verificação',
          message: 'Use o código abaixo para verificar sua conta shadow no PocketMed.',
          code,
          footer: 'Se você não solicitou este código, ignore este email.',
        }),
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
        subject: 'Confirme seu email - PocketMed',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de verificação',
          message: 'Bem-vindo(a) ao PocketMed! Para concluir seu cadastro, insira o código abaixo no aplicativo.',
          code,
          footer: 'Se você não criou uma conta no PocketMed, ignore este email.',
        }),
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
        html: this.buildEmailHtml({
          userName,
          title: 'Código de recuperação',
          message: 'Você solicitou a recuperação de senha da sua conta PocketMed. Use o código abaixo para redefinir sua senha.',
          code,
          footer: 'Se você não solicitou a recuperação de senha, ignore este email. Sua senha permanecerá inalterada.',
        }),
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
