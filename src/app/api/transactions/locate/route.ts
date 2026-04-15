import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/transactions/locate?id=<transactionId>&limit=50
 * Returns { page } — the 1-based page number the transaction appears on
 * when the table is sorted by date desc with the given page size.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const limit = Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '50'));

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const target = await prisma.transaction.findUnique({
    where: { id },
    select: { date: true },
  });

  if (!target) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Count transactions that sort before this one.
  // Primary sort: date desc (newer dates come first).
  // Secondary sort: id desc (for same-date ties, higher id comes first).
  // A row sorts before our target if:  date > target.date  OR  (date = target.date AND id > target.id)
  const countBefore = await prisma.transaction.count({
    where: {
      OR: [
        { date: { gt: target.date } },
        { date: target.date, id: { gt: id } },
      ],
    },
  });

  const page = Math.floor(countBefore / limit) + 1;
  return NextResponse.json({ page });
}
