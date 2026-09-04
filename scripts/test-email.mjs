/*
 * Standalone Resend test-send using the current email template.
 * Usage (from pocketmed-backend/):
 *   RESEND_API_KEY=re_xxx EMAIL_FROM="Hispora <noreply@hispora.com.br>" node scripts/test-email.mjs fernando.luckesi94@gmail.com
 *
 * It reads RESEND_API_KEY and EMAIL_FROM from the environment (or from .env if you
 * export them). It sends a sample "verification code" style email so you can
 * validate deliverability + the new header/logo.
 */
import { Resend } from 'resend';

const to = process.argv[2] || 'fernando.luckesi94@gmail.com';
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || 'Hispora <noreply@hispora.com.br>';
const webUrl = (process.env.WEB_URL || 'https://hispora.com.br').replace(/\/+$/, '');
const logoUrl = process.env.EMAIL_LOGO_URL || `${webUrl}/icon.png`;

if (!apiKey || apiKey.includes('YOUR_API_KEY') || apiKey.includes('placeholder')) {
  console.error(
    '\n[ERRO] RESEND_API_KEY ausente ou inválida.\n' +
      'Rode assim (PowerShell/cmd):\n' +
      '  set RESEND_API_KEY=re_suachave&& set EMAIL_FROM=Hispora ^<noreply@hispora.com.br^>&& node scripts/test-email.mjs fernando.luckesi94@gmail.com\n',
  );
  process.exit(1);
}

const year = new Date().getFullYear();
const code = String(Math.floor(100000 + Math.random() * 900000));

const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f7fa;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#0d47a1 0%,#1B3FCC 55%,#2B5AED 100%);padding:32px 40px;text-align:center;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
              <tr>
                <td style="padding-right:12px;vertical-align:middle;">
                  <img src="${logoUrl}" alt="Hispora" width="40" height="40" style="border-radius:10px;display:block;background-color:rgba(255,255,255,0.15);" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">His</span><span style="font-size:26px;font-weight:800;color:#a8c4ff;letter-spacing:-0.5px;">pora</span>
                </td>
              </tr>
            </table>
            <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Seu histórico de saúde, sempre com você</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 24px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a2e;">Olá, Fernando!</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">Este é um email de teste do Hispora enviado pelo Resend a partir do domínio hispora.com.br.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="padding:20px;background-color:#f0f4ff;border-radius:12px;border:1px dashed #1B3FCC40;">
                  <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Código de teste</p>
                  <p style="margin:0;font-size:36px;font-weight:800;color:#1B3FCC;letter-spacing:8px;font-family:'Courier New',monospace;">${code}</p>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">Se você recebeu este email, a configuração de envio está funcionando. 🎉</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.5;">Este é um email automático. Não responda.<br>© ${year} Hispora. Todos os direitos reservados.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({
  from,
  to,
  subject: 'Teste de envio - Hispora',
  html,
});

if (error) {
  console.error('[FALHA] Erro ao enviar:', error);
  process.exit(1);
}
console.log('[OK] Email enviado com sucesso. ID:', data?.id, '-> destinatário:', to);
