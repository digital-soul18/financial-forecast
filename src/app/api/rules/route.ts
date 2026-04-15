import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const rules = await prisma.categoryRule.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(rules.map(r => ({
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  })));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pattern, category, subcategory, learnedFrom, transactionId } = body;

  if (!pattern || !category) {
    return NextResponse.json({ error: 'pattern and category required' }, { status: 400 });
  }

  const rule = await prisma.categoryRule.create({
    data: { pattern, category, subcategory: subcategory ?? null, learnedFrom: learnedFrom ?? null },
  });

  // If transactionId provided, update that transaction too
  if (transactionId) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { category, subcategory: subcategory ?? null, categorySource: 'manual' },
    });
  }

  return NextResponse.json({
    ...rule,
    createdAt: rule.createdAt instanceof Date ? rule.createdAt.toISOString() : rule.createdAt,
  });
}
