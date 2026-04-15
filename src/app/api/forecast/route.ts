import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeForecast } from '@/lib/forecast/forecastEngine';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const horizonMonths = parseInt(searchParams.get('months') ?? '6');

  // Get all transactions grouped by month + category
  const transactions = await prisma.transaction.findMany({
    select: { date: true, amount: true, category: true },
    where: { category: { not: null } },
    orderBy: { date: 'asc' },
  });

  // Build monthly totals
  const monthMap: Record<string, Record<string, number>> = {};
  for (const t of transactions) {
    const month = format(new Date(t.date), 'yyyy-MM');
    const cat = t.category ?? 'other_expenses';
    if (!monthMap[month]) monthMap[month] = {};
    monthMap[month][cat] = (monthMap[month][cat] ?? 0) + t.amount;
  }

  const monthlyTotals = Object.entries(monthMap).flatMap(([month, cats]) =>
    Object.entries(cats).map(([category, total]) => ({ month, category, total })),
  );

  // Get latest balance from NAB
  const latestNab = await prisma.transaction.findFirst({
    where: { source: 'nab', balance: { not: null } },
    orderBy: { date: 'desc' },
    select: { balance: true },
  });

  const currentBalance = latestNab?.balance ?? 0;
  const result = computeForecast(monthlyTotals, horizonMonths, currentBalance);

  return NextResponse.json(result);
}
