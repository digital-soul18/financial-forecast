import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { overtimeRequestEmailHtml } from '@/lib/email/templates';
import { signOvertimeToken } from '@/lib/auth/hmac';
import { getApproverEmail } from '@/lib/contractors/approver';
import { getAppUrl } from '@/lib/appUrl';
import { format } from 'date-fns';

function serializeOvertime(o: {
  id: string; contractorId: string; overtimeDate: Date; hours: number; reason: string;
  status: string; adminNote: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    ...o,
    overtimeDate: o.overtimeDate.toISOString(),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

// GET — contractor fetches own (?mine=true) or admin filters by ?contractorId=
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');
    const { searchParams } = new URL(req.url);
    const mine = searchParams.get('mine') === 'true';
    const contractorId = searchParams.get('contractorId');
    const status = searchParams.get('status');

    let where: Record<string, unknown> = {};

    if (mine && userId) {
      const contractor = await prisma.contractor.findUnique({ where: { userId } });
      if (!contractor) return NextResponse.json({ overtimeRequests: [] });
      where.contractorId = contractor.id;
    } else if (contractorId && userRole === 'admin') {
      where.contractorId = contractorId;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (status) where.status = status;

    const overtimeRequests = await prisma.overtimeRequest.findMany({
      where,
      orderBy: { overtimeDate: 'desc' },
    });

    return NextResponse.json({ overtimeRequests: overtimeRequests.map(serializeOvertime) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — contractor submits an overtime request
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contractor = await prisma.contractor.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!contractor) return NextResponse.json({ error: 'Contractor account not found' }, { status: 403 });

    const { overtimeDate, hours, reason } = await req.json();
    if (!overtimeDate || !hours || !reason) {
      return NextResponse.json({ error: 'overtimeDate, hours, and reason are required' }, { status: 400 });
    }
    if (typeof hours !== 'number' || hours <= 0 || hours > 24) {
      return NextResponse.json({ error: 'hours must be a positive number ≤ 24' }, { status: 400 });
    }

    const ot = await prisma.overtimeRequest.create({
      data: {
        contractorId: contractor.id,
        overtimeDate: new Date(overtimeDate),
        hours,
        reason,
        status: 'pending',
      },
    });

    // Notify approver
    const appUrl = getAppUrl();
    const approverEmail = await getApproverEmail();
    if (approverEmail) {
      const dateFormatted = format(new Date(overtimeDate), 'EEEE, d MMMM yyyy');
      const approveUrl = `${appUrl}/api/overtime/${ot.id}/action?action=approve&token=${signOvertimeToken(ot.id, 'approve')}`;
      const denyUrl    = `${appUrl}/api/overtime/${ot.id}/action?action=deny&token=${signOvertimeToken(ot.id, 'deny')}`;

      sendEmail({
        to: approverEmail,
        subject: `Overtime Request — ${contractor.name} — ${dateFormatted}`,
        html: overtimeRequestEmailHtml({
          contractorName: contractor.name,
          overtimeDate: dateFormatted,
          hours,
          reason,
          approveUrl,
          denyUrl,
        }),
      }).catch((err) => console.error('Overtime notification email failed:', err));
    }

    return NextResponse.json({ overtimeRequest: serializeOvertime(ot) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
