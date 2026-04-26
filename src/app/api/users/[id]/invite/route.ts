import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { adminInviteEmailHtml, inviteEmailHtml } from '@/lib/email/templates';
import { getAppUrl } from '@/lib/appUrl';

type Params = Promise<{ id: string }>;

/** Admin-only: re-send the invite email for any user (admin or contractor). */
export async function POST(_req: NextRequest, { params }: { params: Params }) {
  if (_req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { contractor: { select: { name: true } } },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const appUrl = getAppUrl();
    const name = user.name ?? user.email;

    if (user.role === 'admin') {
      await sendEmail({
        to: user.email,
        subject: "You've been invited to Voice AI Solutions — Vantage Investor Portal",
        html: adminInviteEmailHtml({ name, appUrl }),
      });
    } else {
      await sendEmail({
        to: user.email,
        subject: "You've been invited to the Voice AI Solutions Contractor Portal",
        html: inviteEmailHtml({ name: user.contractor?.name ?? name, appUrl }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/users/[id]/invite error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
