import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailEnabled: boolean;
  private readonly emailMockFallback: boolean;
  private readonly resend: Resend;
  private readonly emailFrom: string;

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

    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.emailFrom = this.configService.get<string>('EMAIL_FROM') || 'PocketMed <noreply@pocketmed.com>';

    if (!this.emailEnabled) {
      this.logger.warn(
        'Email sending is disabled by EMAIL_ENABLED=false. Verification/reset codes will be logged only.',
      );
    }

    if (this.emailMockFallback) {
      this.logger.warn(
        'Email mock fallback is enabled (EMAIL_MOCK_FALLBACK=true). Send errors will fallback to log-only mode.',
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

    const message = String(error?.message || '').toLowerCase();

    return (
      message.includes('api key') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('rate limit') ||
      message.includes('timeout')
    );
  }

  private logMockCode(email: string, code: string, purpose: string) {
    this.logger.warn(
      `[EMAIL_MOCK] ${purpose} code for ${email}: ${code}. Delivery mocked due to send fallback.`,
    );
  }

  private rethrowEmailError(error: any, context: string) {
    const errorMessage = error?.message || 'Unknown email error';
    this.logger.error(`${context}: ${errorMessage}`);

    throw new ServiceUnavailableException(
      'Falha ao enviar e-mail. Verifique RESEND_API_KEY e EMAIL_FROM ou desative envio com EMAIL_ENABLED=false no ambiente local.',
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

  async sendInviteEmail(email: string, patientName: string, doctorName: string) {
    try {
      const enabledFlag = this.emailEnabled;
      if (!enabledFlag) {
        this.logger.warn(
          `[EMAIL_DISABLED] Invite email for ${email} not sent because EMAIL_ENABLED=false.`,
        );
        return;
      }

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: `${doctorName} adicionou você ao PocketMed`,
        html: this.buildInviteEmailHtml(patientName, doctorName),
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Invite email sent to ${email}`);
    } catch (error) {
      if (this.shouldUseMockFallback(error)) {
        this.logger.warn(`Falling back to mock invite email delivery for ${email}.`);
        return;
      }
      this.rethrowEmailError(error, 'Error sending invite email');
    }
  }

  private buildInviteEmailHtml(patientName: string, doctorName: string): string {
    const appStoreUrl = 'https://apps.apple.com/br/app/meu-einstein/id1674798757';
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=br.com.einstein.app';

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
          <!-- Header -->
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
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a2e;">Olá, ${patientName}!</h1>
              <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6;">
                O(a) <strong>Dr(a). ${doctorName}</strong> cadastrou seus dados no PocketMed para que você tenha acesso ao seu prontuário digital.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
                Com o PocketMed você pode:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                <tr><td style="padding:4px 0;font-size:14px;color:#334155;">✓ Acessar consultas e resultados de exames</td></tr>
                <tr><td style="padding:4px 0;font-size:14px;color:#334155;">✓ Receber lembretes de medicamentos</td></tr>
                <tr><td style="padding:4px 0;font-size:14px;color:#334155;">✓ Manter seu histórico médico organizado</td></tr>
                <tr><td style="padding:4px 0;font-size:14px;color:#334155;">✓ Compartilhar dados com profissionais de confiança</td></tr>
              </table>
              <!-- CTA Buttons -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <a href="${appStoreUrl}" style="display:inline-block;background-color:#1B3FCC;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;">
                      Baixar para iPhone
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${playStoreUrl}" style="display:inline-block;background-color:#1a1a2e;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;">
                      Baixar para Android
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;text-align:center;">
                Ao abrir o app, use o email <strong>${patientName.split(' ')[0].toLowerCase()}...</strong> para ativar sua conta.
              </p>
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

  async sendShadowActivationCode(email: string, code: string, userName: string) {
    try {
      if (!this.ensureEmailEnabledOrLogFallback(email, code, 'Shadow activation')) {
        return;
      }

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Ative sua conta - PocketMed',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de ativação',
          message: 'Um profissional de saúde criou sua conta no PocketMed. Use o código abaixo para ativar sua conta e definir uma senha.',
          code,
          footer: 'Se você não reconhece esta solicitação, ignore este email.',
        }),
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Shadow activation code sent to ${email}`);
    } catch (error) {
      if (this.shouldUseMockFallback(error)) {
        this.logger.warn(`Falling back to mock shadow activation delivery for ${email}.`);
        this.logMockCode(email, code, 'Shadow activation');
        return;
      }
      this.rethrowEmailError(error, 'Error sending shadow activation email');
    }
  }

  async sendVerificationCode(email: string, code: string, userName: string) {
    try {
      if (!this.ensureEmailEnabledOrLogFallback(email, code, 'Verification')) {
        return;
      }

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Código de Verificação - PocketMed',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de verificação',
          message: 'Use o código abaixo para verificar sua conta shadow no PocketMed.',
          code,
          footer: 'Se você não solicitou este código, ignore este email.',
        }),
      });

      if (error) {
        throw new Error(error.message);
      }

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

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Confirme seu email - PocketMed',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de verificação',
          message: 'Bem-vindo(a) ao PocketMed! Para concluir seu cadastro, insira o código abaixo no aplicativo.',
          code,
          footer: 'Se você não criou uma conta no PocketMed, ignore este email.',
        }),
      });

      if (error) {
        throw new Error(error.message);
      }

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

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Recuperação de Senha - PocketMed',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de recuperação',
          message: 'Você solicitou a recuperação de senha da sua conta PocketMed. Use o código abaixo para redefinir sua senha.',
          code,
          footer: 'Se você não solicitou a recuperação de senha, ignore este email. Sua senha permanecerá inalterada.',
        }),
      });

      if (error) {
        throw new Error(error.message);
      }

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

  async sendAccountDeletionCode(email: string, code: string, userName: string) {
    try {
      if (!this.ensureEmailEnabledOrLogFallback(email, code, 'Account deletion')) {
        return;
      }

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Confirmação de Exclusão de Conta - PocketMed',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de confirmação',
          message: 'Você solicitou a exclusão permanente da sua conta PocketMed. Use o código abaixo para confirmar. Esta ação é irreversível.',
          code,
          footer: 'Se você não solicitou a exclusão da conta, ignore este email e altere sua senha imediatamente.',
        }),
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Account deletion code sent to ${email}`);
    } catch (error) {
      if (this.shouldUseMockFallback(error)) {
        this.logger.warn(`Falling back to mock account deletion email delivery for ${email}.`);
        this.logMockCode(email, code, 'Account deletion');
        return;
      }
      this.rethrowEmailError(error, 'Error sending account deletion email');
    }
  }
}
