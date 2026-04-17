import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { leaveStatusEmailHtml } from '@/lib/email/templates';
import { format } from 'date-fns';

type Params = Promise<{ id: string }>;

// PATCH — admin updates leave request status/note
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const { status, adminNote } = await req.json();

    if (!['pending', 'approved', 'denied'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const lr = await prisma.leaveRequest.update({
      where: { id },
      data: { status, ...(adminNote !== undefined ? { adminNote } : {}) },
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
