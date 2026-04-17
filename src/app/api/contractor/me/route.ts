import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contractor = await prisma.contractor.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true } },
        payslips: { orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }] },
        leaveRequests: { orderBy: { leaveDate: 'desc' } },
      },
    });

    if (!contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });

    return NextResponse.json({
      contractor: {
        ...contractor,
        startDate: contractor.startDate.toISOString(),
        createdAt: contractor.createdAt.toISOString(),
        updatedAt: contractor.updatedAt.toISOString(),
        user: { ...contractor.user, createdAt: contractor.user.createdAt.toISOString() },
        payslips: contractor.payslips.map((p) => ({
          ...p,
          paidAt: p.paidAt instanceof Date ? p.paidAt.toISOString() : p.paidAt,
          generatedAt: p.generatedAt.toISOString(),
        })),
        leaveRequests: contractor.leaveRequests.map((lr) => ({
          ...lr,
          leaveDate: lr.leaveDate.toISOString(),
          createdAt: lr.createdAt.toISOString(),
          updatedAt: lr.updatedAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error('GET /api/contractor/me error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
