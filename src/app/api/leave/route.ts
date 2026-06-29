import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { leaveRequestEmailHtml } from '@/lib/email/templates';
import { signLeaveToken } from '@/lib/auth/hmac';
import { getApproverEmail } from '@/lib/contractors/approver';
import { getAppUrl } from '@/lib/appUrl';
import { classifyForCreate } from '@/lib/leave/createHelper';
import { format } from 'date-fns';

function serializeLeave(lr: {
  id: string; contractorId: string; leaveDate: Date; reason: string;
  status: string; adminNote: string | null;
  leaveType: string | null; days: number; classificationNote: string | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    ...lr,
    leaveDate: lr.leaveDate.toISOString(),
    createdAt: lr.createdAt.toISOString(),
    updatedAt: lr.updatedAt.toISOString(),
  };
}

// GET — contractor fetches own leave (?mine=true) or admin filters by ?contractorId=
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');
    const { searchParams } = new URL(req.url);
    const mine = searchParams.get('mine') === 'true';
    const contractorId = searchParams.get('contractorId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};

    if (mine && userId) {
      const contractor = await prisma.contractor.findUnique({ where: { userId } });
      if (!contractor) return NextResponse.json({ leaveRequests: [] });
      where.contractorId = contractor.id;
    } else if (contractorId && userRole === 'admin') {
      where.contractorId = contractorId;
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (status) where.status = status;

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      orderBy: { leaveDate: 'desc' },
    });

    return NextResponse.json({ leaveRequests: leaveRequests.map(serializeLeave) });
  } catch (err) {
    console.error('GET /api/leave error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — contractor submits a leave request
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contractor = await prisma.contractor.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!contractor) return NextResponse.json({ error: 'Contractor account not found' }, { status: 403 });

    const { leaveDate, reason, leaveType, days } = await req.json();
    if (!leaveDate || !reason) {
      return NextResponse.json({ error: 'leaveDate and reason are required' }, { status: 400 });
    }

    const leaveDateObj = new Date(leaveDate);
    const classified = classifyForCreate({
      leaveDate: leaveDateObj,
      reason,
      explicitType: leaveType ?? null,
      days,
    });

    const lr = await prisma.leaveRequest.create({
      data: {
        contractorId: contractor.id,
        leaveDate: leaveDateObj,
        reason,
        status: 'pending',
        leaveType: classified.leaveType,
        days: classified.days,
        classificationNote: classified.classificationNote,
      },
    });

    // Notify approver via email with approve/deny links
    const appUrl = getAppUrl();
    const approverEmail = await getApproverEmail();

    if (approverEmail) {
      const approveUrl = `${appUrl}/api/leave/${lr.id}/action?action=approve&token=${signLeaveToken(lr.id, 'approve')}`;
      const denyUrl = `${appUrl}/api/leave/${lr.id}/action?action=deny&token=${signLeaveToken(lr.id, 'deny')}`;
      const leaveDateFormatted = format(new Date(leaveDate), 'EEEE, d MMMM yyyy');

      sendEmail({
        to: approverEmail,
        subject: `Leave Request — ${contractor.name} — ${leaveDateFormatted}`,
        html: leaveRequestEmailHtml({
          contractorName: contractor.name,
          leaveDate: leaveDateFormatted,
          reason,
          approveUrl,
          denyUrl,
        }),
      }).catch((err) => console.error('Leave notification email failed:', err));
    }

    return NextResponse.json({ leaveRequest: serializeLeave(lr) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/leave error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
