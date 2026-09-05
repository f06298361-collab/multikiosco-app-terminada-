import crypto from "crypto";

export interface SendInvitationEmailParams {
  toEmail: string;
  adminName: string;
  kioskName: string;
  inviteUrl: string;
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * Generate a cryptographically secure 32-byte hex token and its SHA256 hash.
 * Only the hash is stored in the database. The raw token is sent in the email.
 */
export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Deterministically hash the token for database lookup.
 */
export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Dispatch an invitation email using Resend API (HTTP fetch) or secure development fallback.
 */
export async function sendAdminInvitationEmail(
  params: SendInvitationEmailParams,
): Promise<SendEmailResult> {
  const { toEmail, adminName, kioskName, inviteUrl } = params;
  const apiKey = process.env.RESEND_API_KEY;
  const configuredFrom = process.env.EMAIL_FROM?.trim();
  const fromEmail = configuredFrom && configuredFrom.length > 0
    ? configuredFrom
    : "Ferrapp <onboarding@resend.dev>";

  const emailSubject = `Invitación para administrar ${kioskName} en la plataforma`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Plataforma de Kioscos & Negocios</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Invitación oficial de administración</p>
    </div>
    
    <div style="padding: 28px 24px;">
      <p style="font-size: 16px; margin: 0 0 16px 0;">Hola <strong>${escapeHtml(adminName)}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; color: #334155;">
        Has sido invitado por el SuperAdministrador para gestionar y administrar el negocio <strong>${escapeHtml(kioskName)}</strong>.
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; color: #334155;">
        Para activar tu cuenta y establecer tu propia contraseña de acceso segura, haz clic en el siguiente botón:
      </p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
          Aceptar invitación / Activar mi cuenta
        </a>
      </div>
      
      <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 24px;">
        <p style="font-size: 12px; color: #64748b; margin: 0 0 8px 0;">
          Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
        </p>
        <p style="font-size: 11px; word-break: break-all; color: #2563eb; background-color: #f1f5f9; padding: 10px; border-radius: 8px; margin: 0;">
          ${inviteUrl}
        </p>
      </div>

      <div style="margin-top: 24px; padding: 12px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px;">
        <p style="font-size: 11px; color: #92400e; margin: 0; line-height: 1.4;">
          <strong>🔒 Seguridad:</strong> Este enlace es personal, tiene una vigencia limitada y se invalidará automáticamente una vez que actives tu cuenta.
        </p>
      </div>
    </div>
    
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center;">
      <p style="font-size: 11px; color: #94a3b8; margin: 0;">
        Este es un correo automático enviado por el sistema. Por favor no respondas a este mensaje.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  // SUSPENSIÓN TEMPORAL: Modo manual activo para invitaciones.
  // Resend queda 100% conservado en el código para reactivarse cuando se verifique el dominio propio
  // (mediante RESEND_AUTO_SEND=true en el entorno de Render).
  const isAutoSendEnabled = process.env.RESEND_AUTO_SEND === "true";

  if (!isAutoSendEnabled) {
    console.log("===============================================================");
    console.log("[EMAIL SERVICE - MODO MANUAL TEMPORAL ACTIVO]");
    console.log(`Invitación generada para: ${toEmail} (${adminName})`);
    console.log(`Kiosco asignado: ${kioskName}`);
    console.log(`Enlace único de invitación: ${inviteUrl}`);
    console.log("Nota: Envío automático suspendido hasta verificar dominio en Resend.");
    console.log("===============================================================");
    return {
      ok: true,
      simulated: true,
      messageId: "manual-" + Date.now(),
    };
  }

  if (!apiKey) {
    console.log("===============================================================");
    console.log("[EMAIL SERVICE - RESEND_API_KEY NO CONFIGURADA]");
    console.log(`Para: ${toEmail} (${adminName})`);
    console.log(`Kiosco: ${kioskName}`);
    console.log(`Enlace de invitación seguro: ${inviteUrl}`);
    console.log("===============================================================");
    return {
      ok: true,
      simulated: true,
      messageId: "dev-simulated-" + Date.now(),
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: emailSubject,
        html: htmlBody,
      }),
    });

    const data: any = await response.json();

    if (!response.ok) {
      console.error("[Resend Error]", data);
      return {
        ok: false,
        error: data?.message || "Error al enviar el correo a través de Resend",
      };
    }

    return {
      ok: true,
      messageId: data.id,
      simulated: false,
    };
  } catch (err: any) {
    console.error("[Email Exception]", err);
    return {
      ok: false,
      error: err?.message || "Excepción de red al enviar el correo",
    };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
