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
  private readonly webUrl: string;
  private readonly logoUrl: string;
  private readonly logoHorizontalUrl: string;

  constructor(private configService: ConfigService) {
    const nodeEnv = String(this.configService.get<string>('NODE_ENV') ?? 'development').trim();
    const enabledDefault = nodeEnv === 'development' ? 'false' : 'true';
    const enabledFlag = String(
      this.configService.get<string>('EMAIL_ENABLED') ?? enabledDefault,
    ).trim();
    this.emailEnabled = enabledFlag.toLowerCase() !== 'false';

    const mockFallbackDefault = nodeEnv === 'development' ? 'true' : 'false';
    const mockFallbackFlag = String(
      this.configService.get<string>('EMAIL_MOCK_FALLBACK') ?? mockFallbackDefault,
    ).trim();
    this.emailMockFallback = mockFallbackFlag.toLowerCase() !== 'false';

    const apiKey =
      this.configService.get<string>('RESEND_API_KEY') || 're_placeholder_not_configured';
    this.resend = new Resend(apiKey);
    this.emailFrom =
      this.configService.get<string>('EMAIL_FROM') || 'Hispora <noreply@hispora.com.br>';

    // Base URL of the published web app (used for links and email logo asset).
    this.webUrl = (
      this.configService.get<string>('WEB_URL') || 'https://pocketmed-web-production.up.railway.app'
    ).replace(/\/+$/, '');
    // The brand icon lives in the web app's public/ folder (served at root).
    this.logoUrl = this.configService.get<string>('EMAIL_LOGO_URL') || `${this.webUrl}/icon.png`;
    // Horizontal white wordmark logo (already contains the "Hispora" name),
    // used in the email header on the blue gradient background.
    this.logoHorizontalUrl =
      this.configService.get<string>('EMAIL_LOGO_HORIZONTAL_URL') ||
      `${this.webUrl}/hispora-horizontal-branco.png`;

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
      message.includes('timeout') ||
      // Resend rejects sends from an unverified/misconfigured sender domain.
      // In non-production setups (EMAIL_MOCK_FALLBACK=true) we log the code
      // instead of breaking the whole flow with a 503.
      message.includes('domain') ||
      message.includes('not verified') ||
      message.includes('verify a domain') ||
      message.includes('validation_error') ||
      message.includes('validation error') ||
      message.includes('invalid') ||
      message.includes('from')
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
    actionUrl?: string;
    actionLabel?: string;
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
            <td style="background:linear-gradient(135deg,#0d47a1 0%,#1B3FCC 55%,#2B5AED 100%);padding:32px 40px;text-align:center;">
              <img src="${this.logoHorizontalUrl}" alt="Hispora" height="40" style="display:block;margin:0 auto;max-width:200px;height:40px;" />
              <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Seu histórico de saúde, sempre com você</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 24px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a2e;">Olá, ${options.userName}!</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">${options.message}</p>
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
              ${
                options.actionUrl
                  ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;">
                <tr>
                  <td align="center">
                    <a href="${options.actionUrl}" style="display:inline-block;background-color:#1B3FCC;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;">${options.actionLabel || 'Ativar minha conta'}</a>
                  </td>
                </tr>
              </table>`
                  : ''
              }
              <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">${options.footer}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5;">
                Este é um email automático. Não responda.<br>
                © ${new Date().getFullYear()} Hispora. Todos os direitos reservados.
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
        subject: `${doctorName} adicionou você ao Hispora`,
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
            <td style="background: linear-gradient(135deg,#0d47a1 0%,#1B3FCC 55%,#2B5AED 100%);padding:32px 40px;text-align:center;">
              <img src="${this.logoHorizontalUrl}" alt="Hispora" height="40" style="display:block;margin:0 auto;max-width:200px;height:40px;" />
              <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Seu histórico de saúde, sempre com você</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 24px;">
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a2e;">Olá, ${patientName}!</h1>
              <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6;">
                O(a) <strong>Dr(a). ${doctorName}</strong> cadastrou seus dados no Hispora para que você tenha acesso ao seu prontuário digital.
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6;">
                Com o Hispora você pode:
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
                © ${new Date().getFullYear()} Hispora. Todos os direitos reservados.
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
        subject: 'Ative sua conta - Hispora',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de ativação',
          message:
            'Um profissional de saúde criou sua conta no Hispora. Use o código abaixo para ativá-la e definir sua senha de acesso.',
          code,
          footer: 'Se você não reconhece esta solicitação, pode ignorar este email com segurança.',
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

      const activationUrl = `${this.webUrl}/activate-account?email=${encodeURIComponent(email)}`;

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Ative sua conta - Hispora',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de ativação',
          message:
            'Você foi convidado(a) para acessar o Hispora. Use o código abaixo ou clique no botão para ativar sua conta e criar sua senha.',
          code,
          footer: 'Se você não reconhece esta solicitação, pode ignorar este email com segurança.',
          actionUrl: activationUrl,
          actionLabel: 'Ativar minha conta',
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
        subject: 'Confirme seu email - Hispora',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de verificação',
          message:
            'Bem-vindo(a) ao Hispora! Para concluir seu cadastro, insira o código de verificação abaixo no aplicativo.',
          code,
          footer: 'Se você não criou uma conta no Hispora, pode ignorar este email com segurança.',
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
        subject: 'Recuperação de Senha - Hispora',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de recuperação',
          message:
            'Você solicitou a recuperação de senha da sua conta Hispora. Use o código abaixo para redefinir sua senha.',
          code,
          footer:
            'Se você não solicitou a recuperação de senha, ignore este email. Sua senha permanecerá inalterada.',
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
        subject: 'Confirmação de Exclusão de Conta - Hispora',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de confirmação',
          message:
            'Você solicitou a exclusão permanente da sua conta Hispora. Use o código abaixo para confirmar. Esta ação é irreversível.',
          code,
          footer:
            'Se você não solicitou a exclusão da conta, ignore este email e altere sua senha imediatamente.',
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

  /** Sends the confirmation code to the NEW email the user wants to switch to. */
  async sendEmailChangeCode(email: string, code: string, userName: string) {
    try {
      if (!this.ensureEmailEnabledOrLogFallback(email, code, 'Email change')) {
        return;
      }

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Confirme seu novo email - Hispora',
        html: this.buildEmailHtml({
          userName,
          title: 'Código de confirmação',
          message:
            'Você solicitou a alteração do email da sua conta Hispora para este endereço. Use o código abaixo no aplicativo para confirmar a troca.',
          code,
          footer:
            'Se você não solicitou esta alteração, ignore este email. Nenhuma mudança será feita sem a confirmação do código.',
        }),
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Email change code sent to ${email}`);
    } catch (error) {
      if (this.shouldUseMockFallback(error)) {
        this.logger.warn(`Falling back to mock email change delivery for ${email}.`);
        this.logMockCode(email, code, 'Email change');
        return;
      }
      this.rethrowEmailError(error, 'Error sending email change code');
    }
  }

  /**
   * Notifies the OLD email that the account's email was changed, so the owner
   * can react if they didn't request it (account-takeover defense).
   */
  async sendEmailChangedNotice(oldEmail: string, newEmail: string, userName: string) {
    try {
      // Reuse the enable/mock guard; there is no code, so log a notice on fallback.
      if (!this.emailEnabled) {
        this.logger.warn(
          `[EMAIL_DISABLED] Email-changed notice for ${oldEmail} not sent because EMAIL_ENABLED=false.`,
        );
        return;
      }

      const maskedNew = this.maskEmail(newEmail);
      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f7fa;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#0d47a1 0%,#1B3FCC 55%,#2B5AED 100%);padding:32px 40px;text-align:center;">
          <img src="${this.logoHorizontalUrl}" alt="Hispora" height="40" style="display:block;margin:0 auto;max-width:200px;height:40px;" />
        </td></tr>
        <tr><td style="padding:36px 40px 24px;">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a2e;">Olá, ${userName}!</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">O email de acesso da sua conta Hispora foi alterado para <strong>${maskedNew}</strong>.</p>
          <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">Se foi você, nenhuma ação é necessária.</p>
          <p style="margin:0;font-size:14px;color:#b91c1c;line-height:1.6;font-weight:600;">Se você não reconhece esta alteração, entre em contato com o suporte imediatamente e altere sua senha, pois sua conta pode estar comprometida.</p>
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5;">Este é um email automático. Não responda.<br>© ${new Date().getFullYear()} Hispora. Todos os direitos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: oldEmail,
        subject: 'Seu email de acesso foi alterado - Hispora',
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Email-changed notice sent to ${oldEmail}`);
    } catch (error) {
      // Non-critical: never block the email change because the notice failed.
      this.logger.warn(
        `Could not send email-changed notice to ${oldEmail}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Notifies the doctor that a submitted credential document was rejected and
   * needs to be resubmitted.
   *
   * Non-critical: a failure here must never block the review decision, which is
   * already persisted and audited.
   */
  async sendDocumentRejectedNotice(
    email: string,
    doctorName: string,
    documentLabel: string,
    rejectionReason: string,
  ) {
    try {
      if (!this.emailEnabled) {
        this.logger.warn(
          `[EMAIL_DISABLED] Document-rejected notice for ${email} not sent because EMAIL_ENABLED=false.`,
        );
        return;
      }

      const html = this.buildNoticeHtml({
        userName: doctorName,
        heading: 'Documento não aprovado',
        accentColor: '#b91c1c',
        paragraphs: [
          `Revisamos o documento <strong>${documentLabel}</strong> enviado para a verificação do seu cadastro e ele <strong>não pôde ser aprovado</strong>.`,
          `<strong>Motivo:</strong> ${rejectionReason}`,
          'Envie um novo arquivo pela plataforma para que possamos concluir a sua verificação.',
        ],
        actionUrl: `${this.webUrl}/verification`,
        actionLabel: 'Reenviar documento',
      });

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Documento não aprovado - Hispora',
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Document-rejected notice sent to ${email}`);
    } catch (error) {
      this.logger.warn(
        `Could not send document-rejected notice to ${email}: ${(error as Error).message}`,
      );
    }
  }

  /** Notifies the doctor that a single document was approved. */
  async sendDocumentApprovedNotice(email: string, doctorName: string, documentLabel: string) {
    try {
      if (!this.emailEnabled) {
        this.logger.warn(
          `[EMAIL_DISABLED] Document-approved notice for ${email} not sent because EMAIL_ENABLED=false.`,
        );
        return;
      }

      const html = this.buildNoticeHtml({
        userName: doctorName,
        heading: 'Documento aprovado',
        accentColor: '#047857',
        paragraphs: [
          `O documento <strong>${documentLabel}</strong> foi aprovado pela nossa equipe.`,
          'Assim que todos os documentos forem aprovados, sua verificação será concluída automaticamente.',
        ],
      });

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Documento aprovado - Hispora',
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Document-approved notice sent to ${email}`);
    } catch (error) {
      this.logger.warn(
        `Could not send document-approved notice to ${email}: ${(error as Error).message}`,
      );
    }
  }

  /** Notifies the doctor that the whole verification was approved. */
  async sendVerificationApprovedNotice(email: string, doctorName: string) {
    try {
      if (!this.emailEnabled) {
        this.logger.warn(
          `[EMAIL_DISABLED] Verification-approved notice for ${email} not sent because EMAIL_ENABLED=false.`,
        );
        return;
      }

      const html = this.buildNoticeHtml({
        userName: doctorName,
        heading: 'Verificação concluída',
        accentColor: '#047857',
        paragraphs: [
          'Todos os seus documentos profissionais foram aprovados e o seu cadastro está <strong>verificado</strong>.',
          'Todas as funcionalidades da plataforma já estão liberadas para você.',
        ],
        actionUrl: `${this.webUrl}/dashboard`,
        actionLabel: 'Acessar a plataforma',
      });

      const { error } = await this.resend.emails.send({
        from: this.emailFrom,
        to: email,
        subject: 'Sua verificação foi concluída - Hispora',
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Verification-approved notice sent to ${email}`);
    } catch (error) {
      this.logger.warn(
        `Could not send verification-approved notice to ${email}: ${(error as Error).message}`,
      );
    }
  }

  /** Shared shell for code-less notification emails. */
  private buildNoticeHtml(options: {
    userName: string;
    heading: string;
    paragraphs: string[];
    accentColor?: string;
    actionUrl?: string;
    actionLabel?: string;
  }): string {
    const accent = options.accentColor || '#1B3FCC';
    const body = options.paragraphs
      .map(
        (text) =>
          `<p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">${text}</p>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f7fa;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#0d47a1 0%,#1B3FCC 55%,#2B5AED 100%);padding:32px 40px;text-align:center;">
          <img src="${this.logoHorizontalUrl}" alt="Hispora" height="40" style="display:block;margin:0 auto;max-width:200px;height:40px;" />
        </td></tr>
        <tr><td style="padding:36px 40px 24px;">
          <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#1a1a2e;">Olá, ${options.userName}!</h1>
          <p style="margin:0 0 20px;font-size:13px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1px;">${options.heading}</p>
          ${body}
          ${
            options.actionUrl
              ? `
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 0;">
            <tr><td align="center">
              <a href="${options.actionUrl}" style="display:inline-block;background-color:#1B3FCC;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;">${options.actionLabel || 'Acessar'}</a>
            </td></tr>
          </table>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5;">Este é um email automático. Não responda.<br>© ${new Date().getFullYear()} Hispora. Todos os direitos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  /** Masks an email for display, e.g. "jo***@gmail.com". */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }
}
