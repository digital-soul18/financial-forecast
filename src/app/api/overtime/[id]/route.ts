import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { overtimeStatusEmailHtml } from '@/lib/email/templates';
import { format } from 'date-fns';

type Params = Promise<{ id: string }>;

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

// PATCH — admin updates status / note
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const role = req.headers.get('x-user-role');
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const { status, adminNote } = await req.json();

    if (status && !['pending', 'approved', 'denied'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const ot = await prisma.overtimeRequest.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(adminNote !== undefined ? { adminNote } : {}),
      },
      include: { contractor: { include: { user: true } } },
    });

    // Notify contractor of decision
    if (status === 'approved' || status === 'denied') {
      sendEmail({
        to: ot.contractor.user.email,
        subject: `Overtime ${status === 'approved' ? 'Approved' : 'Denied'} — ${format(ot.overtimeDate, 'd MMMM yyyy')}`,
        html: overtimeStatusEmailHtml({
          name: ot.contractor.name,
          overtimeDate: format(ot.overtimeDate, 'EEEE, d MMMM yyyy'),
          hours: ot.hours,
          status: status as 'approved' | 'denied',
          adminNote: adminNote ?? undefined,
        }),
      }).catch((err) => console.error('Overtime status email failed:', err));
    }

    return NextResponse.json({ overtimeRequest: serializeOvertime(ot) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — admin removes overtime request
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.overtimeRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
