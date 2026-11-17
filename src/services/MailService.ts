export type MailDeliveryMode = "brevo" | "resend" | "console";

interface SendPasswordResetParams {
  toEmail: string;
  toName: string;
  code: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildResetEmailContent(toName: string, code: string) {
  const firstName = escapeHtml(toName.trim().split(/\s+/)[0] || "Cuidador");
  const safeCode = escapeHtml(code);
  const subject = "CuiDA - Código de recuperação de senha";

  const textContent = [
    `Olá, ${toName.trim().split(/\s+/)[0] || "Cuidador"}!`,
    "",
    "Recebemos uma solicitação para redefinir a senha da sua conta no CuiDA.",
    `Seu código de verificação é: ${code}`,
    "",
    "Esse código é válido por 15 minutos.",
    "Se você não solicitou a troca de senha, apenas ignore este e-mail.",
  ].join("\n");

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background-color: #f7f4ef; padding: 24px; color: #334155;">
      <div style="max-width: 460px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background-color: #6f2dbd; padding: 20px; text-align: center;">
          <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">CuiDA</span>
        </div>
        <div style="padding: 28px 24px; text-align: center;">
          <h2 style="margin: 0 0 12px; color: #5b21b6; font-size: 18px;">Recuperação de Senha</h2>
          <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.6;">
            Olá, <strong>${firstName}</strong>! Use o código abaixo para redefinir sua senha no aplicativo CuiDA:
          </p>
          <div style="display: inline-block; background: #ede9fe; border: 1px solid #c4b5fd; border-radius: 12px; padding: 14px 28px; margin-bottom: 18px;">
            <span style="font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #4c1d95;">${safeCode}</span>
          </div>
          <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">
            Este código expira em <strong>15 minutos</strong>.
          </p>
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">
            Se você não fez esta solicitação, ignore este e-mail.
          </p>
        </div>
      </div>
    </div>
  `;

  return { subject, textContent, htmlContent };
}

function resolveProvider(): MailDeliveryMode {
  const configured = (process.env.MAIL_PROVIDER || "").trim().toLowerCase();
  if (configured === "brevo" || configured === "resend" || configured === "console") {
    return configured;
  }
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.RESEND_API_KEY) return "resend";
  return "console";
}

async function sendViaBrevo(params: SendPasswordResetParams) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.MAIL_FROM_EMAIL;
  const senderName = process.env.MAIL_FROM_NAME || "CuiDA Apoio";

  if (!apiKey || !senderEmail) {
    throw new Error("Configure BREVO_API_KEY e MAIL_FROM_EMAIL no .env para enviar via Brevo.");
  }

  const { subject, textContent, htmlContent } = buildResetEmailContent(params.toName, params.code);

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ name: params.toName, email: params.toEmail }],
      subject,
      htmlContent,
      textContent,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
  }
}

async function sendViaResend(params: SendPasswordResetParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.MAIL_FROM_EMAIL || "onboarding@resend.dev";
  const senderName = process.env.MAIL_FROM_NAME || "CuiDA Apoio";

  if (!apiKey) {
    throw new Error("Configure RESEND_API_KEY no .env para enviar via Resend.");
  }

  const { subject, textContent, htmlContent } = buildResetEmailContent(params.toName, params.code);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${senderName} <${senderEmail}>`,
      to: [params.toEmail],
      subject,
      html: htmlContent,
      text: textContent,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }
}

export async function sendPasswordResetEmail(
  params: SendPasswordResetParams
): Promise<MailDeliveryMode> {
  const provider = resolveProvider();

  if (provider === "brevo") {
    await sendViaBrevo(params);
    return "brevo";
  }

  if (provider === "resend") {
    await sendViaResend(params);
    return "resend";
  }

  // Modo desenvolvimento sem provedor externo configurado: imprime o código apenas no terminal do servidor
  console.log("==================================================");
  console.log("[CuiDA - Recuperação de Senha (Modo Terminal)]");
  console.log(`Destinatário: ${params.toEmail}`);
  console.log(`Código (válido por 15 min): ${params.code}`);
  console.log("==================================================");

  return "console";
}
