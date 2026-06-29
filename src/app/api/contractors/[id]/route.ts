import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type Params = Promise<{ id: string }>;

function serializeDates(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = v instanceof Date ? v.toISOString() : v;
  }
  return result;
}

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: {
        user: true,
        leaveRequests: { orderBy: { leaveDate: 'desc' } },
        overtimeRequests: { orderBy: { overtimeDate: 'desc' } },
        payslips: { orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }] },
      },
    });
    if (!contractor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      contractor: {
        ...serializeDates(contractor as unknown as Record<string, unknown>),
        user: serializeDates(contractor.user as unknown as Record<string, unknown>),
        leaveRequests: contractor.leaveRequests.map(lr =>
          serializeDates(lr as unknown as Record<string, unknown>)
        ),
        overtimeRequests: contractor.overtimeRequests.map(ot =>
          serializeDates(ot as unknown as Record<string, unknown>)
        ),
        payslips: contractor.payslips.map(p =>
          serializeDates(p as unknown as Record<string, unknown>)
        ),
      },
    });
  } catch (err) {
    console.error('GET /api/contractors/[id] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const contractorUpdates: Record<string, unknown> = {};
    const userUpdates: Record<string, unknown> = {};

    if ('name' in body) { contractorUpdates.name = body.name; userUpdates.name = body.name; }
    if ('dailyRate' in body) contractorUpdates.dailyRate = Number(body.dailyRate);
    if ('startDate' in body) contractorUpdates.startDate = new Date(body.startDate);
    if ('currency' in body) contractorUpdates.currency = String(body.currency).toUpperCase();
    if ('isActive' in body) {
      contractorUpdates.isActive = body.isActive;
      userUpdates.isActive = body.isActive;
    }
    // Leave-policy fields (see src/lib/leave/)
    if ('probationMonths' in body) contractorUpdates.probationMonths = Math.max(0, Number(body.probationMonths));
    if ('country' in body) contractorUpdates.country = String(body.country).toUpperCase();
    if ('accrualUsableDuringProbation' in body) {
      contractorUpdates.accrualUsableDuringProbation = Boolean(body.accrualUsableDuringProbation);
    }
    if ('vlAccrualPerMonth' in body) contractorUpdates.vlAccrualPerMonth = Number(body.vlAccrualPerMonth);
    if ('slAccrualPerMonth' in body) contractorUpdates.slAccrualPerMonth = Number(body.slAccrualPerMonth);

    const contractor = await prisma.$transaction(async (tx) => {
      const c = await tx.contractor.update({
        where: { id },
        data: contractorUpdates,
        include: { user: true },
      });
      if (Object.keys(userUpdates).length > 0) {
        await tx.user.update({ where: { id: c.userId }, data: userUpdates });
      }
      return tx.contractor.findUnique({ where: { id }, include: { user: true } });
    });

    return NextResponse.json({
      contractor: {
        ...serializeDates(contractor as unknown as Record<string, unknown>),
        user: serializeDates(contractor!.user as unknown as Record<string, unknown>),
      },
    });
  } catch (err) {
    console.error('PATCH /api/contractors/[id] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Soft delete — set isActive = false
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    await prisma.$transaction(async (tx) => {
      const c = await tx.contractor.update({ where: { id }, data: { isActive: false } });
      await tx.user.update({ where: { id: c.userId }, data: { isActive: false } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/contractors/[id] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
