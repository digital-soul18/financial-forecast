import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? `email-smtp.ap-southeast-2.amazonaws.com`,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false, // STARTTLS on port 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const from = process.env.SES_FROM ?? 'Voice AI Solutions <noreply@voiceaisolutions.com.au>';
  console.log(`[sendEmail] sending to=${opts.to} subject="${opts.subject}" from=${from} host=${process.env.SMTP_HOST}`);
  const info = await getTransporter().sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  console.log(`[sendEmail] sent messageId=${info.messageId}`);
}
