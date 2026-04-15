import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');
  const source = searchParams.get('source');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '50');
  const sortBy = searchParams.get('sortBy') ?? 'date';
  const sortDir = (searchParams.get('sortDir') ?? 'desc') as 'asc' | 'desc';

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (subcategory) where.subcategory = subcategory;
  if (source) where.source = source;
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }
  if (search) {
    where.OR = [
      { transactionDetails: { contains: search } },
      { merchantName: { contains: search } },
    ];
  }

  const [transactions, total, sumResult] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ [sortBy]: sortDir }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { attachments: { select: { id: true, filename: true, fileSize: true, uploadedAt: true } } },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({ where, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    transactions: transactions.map(t => ({
      ...t,
      date: t.date instanceof Date ? t.date.toISOString() : t.date,
      processedOn: t.processedOn instanceof Date ? t.processedOn.toISOString() : t.processedOn,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
      updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
      attachments: t.attachments.map(a => ({
        ...a,
        uploadedAt: a.uploadedAt instanceof Date ? a.uploadedAt.toISOString() : a.uploadedAt,
      })),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    sum: sumResult._sum.amount ?? 0,
  });
}
