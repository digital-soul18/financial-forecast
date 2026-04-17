import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

let _ses: SESClient | null = null;

function getSes(): SESClient {
  if (!_ses) {
    const region = process.env.AWS_SES_REGION ?? process.env.AWS_REGION ?? 'ap-southeast-2';
    _ses = new SESClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _ses;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const from = process.env.SES_FROM ?? 'Voice AI Solutions <noreply@voiceaisolutions.com.au>';

  const command = new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: [opts.to] },
    Message: {
      Subject: { Data: opts.subject, Charset: 'UTF-8' },
      Body: { Html: { Data: opts.html, Charset: 'UTF-8' } },
    },
  });

  await getSes().send(command);
}
