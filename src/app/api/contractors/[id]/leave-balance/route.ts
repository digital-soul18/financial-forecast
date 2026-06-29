import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeBalanceForContractor } from '@/lib/leave/server';

type Params = Promise<{ id: string }>;

/**
 * GET /api/contractors/[id]/leave-balance?asOf=YYYY-MM-DD
 *
 * Auth:
 *   • admin → any contractor
 *   • contractor → only their own record
 *
 * Returns the engine's LeaveBalance for the given as-of date (defaults to today).
 */
export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    // Authorization: admin OR the contractor themselves
    if (role !== 'admin') {
      const c = await prisma.contractor.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!c || c.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(req.url);
    const asOfParam = searchParams.get('asOf');
    const asOf = asOfParam ? new Date(asOfParam) : new Date();
    if (Number.isNaN(asOf.getTime())) {
      return NextResponse.json({ error: 'Invalid asOf date' }, { status: 400 });
    }

    const balance = await computeBalanceForContractor(id, asOf);

    return NextResponse.json({
      balance: {
        asOf: balance.asOf.toISOString(),
        completedMonths: balance.completedMonths,
        monthsUntilNextAnniversary: balance.monthsUntilNextAnniversary,
        regularisationDate: balance.regularisationDate.toISOString(),
        nextAnniversaryDate: balance.nextAnniversaryDate.toISOString(),
        isLockedByProbation: balance.isLockedByProbation,
        vl: balance.vl,
        sl: balance.sl,
      },
    });
  } catch (err) {
    console.error('GET /api/contractors/[id]/leave-balance error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
