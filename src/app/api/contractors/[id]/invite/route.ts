import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { inviteEmailHtml } from '@/lib/email/templates';
import { getAppUrl } from '@/lib/appUrl';

type Params = Promise<{ id: string }>;

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!contractor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const appUrl = getAppUrl();
    await sendEmail({
      to: contractor.user.email,
      subject: `You've been invited to the Voice AI Solutions Contractor Portal`,
      html: inviteEmailHtml({ name: contractor.name, appUrl }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/contractors/[id]/invite error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
