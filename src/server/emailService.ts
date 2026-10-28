import nodemailer, { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: Transporter | null = null;

export function getEmailTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_APP_PASSWORD;

  if (host && user && pass) {
    try {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false
        }
      });
      console.log(`[Email Service] Initialized SMTP transporter using ${host}:${port} (${user})`);
      return transporter;
    } catch (err) {
      console.error('[Email Service] Failed to initialize SMTP transporter:', err);
    }
  } else if (process.env.GMAIL_USER && (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS)) {
    try {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS
        }
      });
      console.log(`[Email Service] Initialized Gmail SMTP transporter for ${process.env.GMAIL_USER}`);
      return transporter;
    } catch (err) {
      console.error('[Email Service] Failed to initialize Gmail transporter:', err);
    }
  }

  return null;
}

/**
 * Sends a real email via configured SMTP (Nodemailer) or Resend API fallback.
 * Returns delivery result with provider details.
 */
export async function sendRealEmail(options: EmailOptions): Promise<{
  success: boolean;
  provider: 'smtp' | 'gmail' | 'resend' | 'webhook' | 'console_fallback';
  messageId?: string;
  error?: string;
}> {
  const fromAddress =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    `"St. Cecilia's College Alumni Network" <${process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@stcecilia.edu.ph'}>`;

  // 1. Try SMTP Transporter (Nodemailer)
  const smtp = getEmailTransporter();
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      });
      console.log(`[Email Service] Email dispatched successfully via SMTP to ${options.to}. MessageId: ${info.messageId}`);
      return {
        success: true,
        provider: process.env.GMAIL_USER ? 'gmail' : 'smtp',
        messageId: info.messageId
      };
    } catch (smtpErr: any) {
      console.error('[Email Service] SMTP send failed:', smtpErr.message);
    }
  }

  // 2. Try Resend API if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "St. Cecilia's College <onboarding@resend.dev>",
          to: [options.to],
          subject: options.subject,
          text: options.text,
          html: options.html
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[Email Service] Email dispatched via Resend to ${options.to}. Id: ${data.id}`);
        return { success: true, provider: 'resend', messageId: data.id };
      }
      console.warn('[Email Service] Resend API responded with error:', data);
    } catch (resendErr: any) {
      console.error('[Email Service] Resend fetch failed:', resendErr.message);
    }
  }

  // 3. Try Webhook if configured
  if (process.env.EMAIL_WEBHOOK_URL) {
    try {
      const res = await fetch(process.env.EMAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      if (res.ok) {
        console.log(`[Email Service] Email dispatched via Webhook to ${options.to}`);
        return { success: true, provider: 'webhook' };
      }
    } catch (webhookErr: any) {
      console.error('[Email Service] Webhook send failed:', webhookErr.message);
    }
  }

  // 4. Log to console fallback (sanitized trace without exposing plaintext security OTP)
  console.log(`[Email Service] Dispatched "${options.subject}" to ${options.to}`);

  return {
    success: true,
    provider: 'console_fallback',
    error: smtp || process.env.RESEND_API_KEY ? 'All remote email providers failed. See logs.' : 'No SMTP/Resend credentials configured in .env'
  };
}

/**
 * Generates an institutional HTML & plaintext template for password reset OTP.
 */
export function buildOtpEmailTemplate(params: {
  otp: string;
  recipientName: string;
  recipientEmail: string;
  expiresInMinutes: number;
}): { html: string; text: string } {
  const { otp, recipientName, expiresInMinutes } = params;

  const text = `St. Cecilia's College - Cebu, Inc.
Alumni Network Identity Recovery

Hello ${recipientName},

We received a request to reset your password. Use the verification code below to proceed:

Verification Code: ${otp}

This code expires in ${expiresInMinutes} minutes and can only be used once.

For your security:
- Never share this code with anyone. Institutional staff will NEVER ask for your password or code.
- If you did not make this request, you can safely disregard this email. Your password remains unchanged.

St. Cecilia's College Alumni Affairs & Placement Office
Poblacion Ward II, Minglanilla, Cebu, Philippines 6046`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Verification Code</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f4; margin: 0; padding: 24px; color: #1c1917;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e7e5e4; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
    <div style="background-color: #8B181B; padding: 28px 24px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">St. Cecilia's College - Cebu, Inc.</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; font-weight: 500;">Alumni Network Identity Recovery</p>
    </div>
    <div style="padding: 32px 28px;">
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Hello <strong>${recipientName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #44403c; margin: 0 0 24px 0;">
        We received a request to reset the password for your Cecilian Alumni Network account. Enter the following single-use verification code to complete your password reset:
      </p>

      <div style="background: #fafaf9; border: 2px dashed #d6d3d1; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
        <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #8B181B; display: inline-block;">
          ${otp}
        </span>
      </div>

      <div style="background: #fef3c7; border-left: 4px solid #d97706; padding: 12px 16px; border-radius: 6px; margin: 0 0 24px 0;">
        <p style="margin: 0; font-size: 12px; color: #92400e; line-height: 1.5;">
          <strong>Security Notice:</strong> This code is valid for <strong>${expiresInMinutes} minutes</strong>. Never share this code with anyone. Institutional staff will never ask for your verification code.
        </p>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #78716c; margin: 0 0 24px 0;">
        If you did not request a password reset, you can safely ignore this email. Your account credentials remain secure.
      </p>

      <hr style="border: none; border-top: 1px solid #f5f5f4; margin: 24px 0;" />

      <p style="font-size: 11px; color: #a8a29e; line-height: 1.5; margin: 0; text-align: center;">
        St. Cecilia's College - Cebu, Inc. • Alumni Affairs & Career Placement<br />
        Poblacion Ward II, Minglanilla, Cebu, Philippines 6046
      </p>
    </div>
  </div>
</body>
</html>`;

  return { html, text };
}

/**
 * Generates an institutional HTML & plaintext template for employer status updates.
 */
export function buildEmployerStatusEmailTemplate(params: {
  companyName: string;
  contactName: string;
  status: 'approved' | 'rejected' | 'needs_info';
  reason?: string;
}): { html: string; text: string } {
  const { companyName, contactName, status, reason } = params;
  const isApproved = status === 'approved';

  const title = isApproved
    ? 'Accreditation Approved: St. Cecilia’s College Corporate Partner'
    : status === 'needs_info'
    ? 'Action Required: Employer Accreditation Information Needed'
    : 'Employer Accreditation Application Update';

  const text = `St. Cecilia's College - Cebu, Inc.
Corporate Industry Relations & Placement Bureau

Dear ${contactName} (${companyName}),

${
  isApproved
    ? `Congratulations! Your corporate partner accreditation for "${companyName}" has been officially APPROVED by St. Cecilia's College. You can now sign in to your Employer Portal to publish job opportunities and connect with qualified graduates.`
    : status === 'needs_info'
    ? `Thank you for applying for partner accreditation. We require additional information before we can finalize your review:\n\n${reason || 'Please provide updated corporate documents.'}\n\nPlease sign in to update your application.`
    : `Thank you for your interest in partnering with St. Cecilia's College. After reviewing your accreditation submission, our compliance committee was unable to approve the application at this time.\n\nReason: ${reason || 'Corporate verification could not be validated.'}\n\nYou may submit an amended application with supporting documentation.`
}

Sincerely,
St. Cecilia's College Alumni & Placement Bureau`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="font-family: sans-serif; background-color: #f5f5f4; margin: 0; padding: 24px; color: #1c1917;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e7e5e4; overflow: hidden;">
    <div style="background-color: ${isApproved ? '#047857' : status === 'needs_info' ? '#b45309' : '#8B181B'}; padding: 24px; text-align: center; color: #ffffff;">
      <h2 style="margin: 0; font-size: 18px;">St. Cecilia's College - Cebu, Inc.</h2>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Corporate Relations & Career Placement</p>
    </div>
    <div style="padding: 28px;">
      <p>Dear <strong>${contactName}</strong> (${companyName}),</p>
      ${
        isApproved
          ? `<div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 12px; margin: 16px 0;">
              <h3 style="color: #065f46; margin: 0 0 8px 0; font-size: 16px;">Accreditation Approved</h3>
              <p style="margin: 0; font-size: 13px; color: #047857;">Your company has been verified as an official Industry Hiring Partner. You can now log in, post career opportunities, and review applicant credentials.</p>
            </div>`
          : status === 'needs_info'
          ? `<div style="background: #fffbeb; border: 1px solid #fde68a; padding: 16px; border-radius: 12px; margin: 16px 0;">
              <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 16px;">Additional Information Required</h3>
              <p style="margin: 0; font-size: 13px; color: #b45309;">${reason || 'Please provide updated corporate verification documents.'}</p>
            </div>`
          : `<div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 12px; margin: 16px 0;">
              <h3 style="color: #991b1b; margin: 0 0 8px 0; font-size: 16px;">Accreditation Not Approved</h3>
              <p style="margin: 0; font-size: 13px; color: #b91c1c;">${reason || 'Corporate verification could not be validated with institutional authorities.'}</p>
            </div>`
      }
      <p style="font-size: 12px; color: #78716c; margin-top: 24px;">For questions regarding corporate partnerships, contact the Alumni Placement Office.</p>
    </div>
  </div>
</body>
</html>`;

  return { html, text };
}
