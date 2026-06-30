import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { leaveStatusEmailHtml } from '@/lib/email/templates';
import { format } from 'date-fns';

type Params = Promise<{ id: string }>;

// PATCH — admin updates leave request status/note
const ALLOWED_TYPES = new Set([
  'VL', 'SL', 'MATERNITY', 'PATERNITY', 'PUBLIC_HOLIDAY', 'UNPAID',
]);

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const { status, adminNote, leaveType } = await req.json();

    // Validate status only if it's actually being changed (it's optional now —
    // admin may PATCH only leaveType / adminNote without changing status).
    if (status !== undefined && !['pending', 'approved', 'denied'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    // leaveType can be null (clear classification) or one of the allowed types.
    if (leaveType !== undefined && leaveType !== null && !ALLOWED_TYPES.has(leaveType)) {
      return NextResponse.json({ error: 'Invalid leaveType' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (status !== undefined)    data.status = status;
    if (adminNote !== undefined) data.adminNote = adminNote;
    if (leaveType !== undefined) {
      data.leaveType = leaveType;
      data.classificationNote = leaveType === null
        ? 'Cleared by admin'
        : 'Set by admin';
    }

    const lr = await prisma.leaveRequest.update({
      where: { id },
      data,
      include: { contractor: { include: { user: true } } },
    });

    // Notify contractor if status changed to approved/denied
    if (status === 'approved' || status === 'denied') {
      const leaveDateFormatted = format(lr.leaveDate, 'EEEE, d MMMM yyyy');
      sendEmail({
        to: lr.contractor.user.email,
        subject: `Leave request ${status} — ${leaveDateFormatted}`,
        html: leaveStatusEmailHtml({
          name: lr.contractor.name,
          leaveDate: leaveDateFormatted,
          status,
          adminNote: lr.adminNote ?? undefined,
        }),
      }).catch((err) => console.error('Leave status email failed:', err));
    }

    return NextResponse.json({
      leaveRequest: {
        ...lr,
        leaveDate: lr.leaveDate.toISOString(),
        createdAt: lr.createdAt.toISOString(),
        updatedAt: lr.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('PATCH /api/leave/[id] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — admin removes a leave request
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.leaveRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/leave/[id] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
