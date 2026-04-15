import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const overrides = await prisma.forecastOverride.findMany({
    orderBy: { month: 'asc' },
  });
  return NextResponse.json(overrides);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    updates: Array<{
      category: string;
      subcategory: string;
      customLabel?: string | null;
      customCategoryLabel?: string | null;
      month: string;
      amount: number;
    }>;
  };

  const results = await Promise.all(
    body.updates.map(u =>
      prisma.forecastOverride.upsert({
        where: {
          category_subcategory_month: {
            category: u.category,
            subcategory: u.subcategory,
            month: u.month,
          },
        },
        update: {
          amount: u.amount,
          ...(u.customLabel !== undefined ? { customLabel: u.customLabel } : {}),
          ...(u.customCategoryLabel !== undefined ? { customCategoryLabel: u.customCategoryLabel } : {}),
        },
        create: {
          category: u.category,
          subcategory: u.subcategory,
          customLabel: u.customLabel ?? null,
          customCategoryLabel: u.customCategoryLabel ?? null,
          month: u.month,
          amount: u.amount,
        },
      })
    )
  );

  return NextResponse.json({ success: true, count: results.length });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json() as {
    category?: string;
    subcategory?: string;
    month?: string;
    clearAll?: boolean;
    deleteCategory?: string; // deletes all overrides for a custom category
  };

  if (body.clearAll) {
    await prisma.forecastOverride.deleteMany();
    return NextResponse.json({ success: true });
  }

  if (body.deleteCategory) {
    await prisma.forecastOverride.deleteMany({
      where: { category: body.deleteCategory },
    });
    return NextResponse.json({ success: true });
  }

  await prisma.forecastOverride.deleteMany({
    where: {
      category: body.category,
      subcategory: body.subcategory,
      month: body.month,
    },
  });

  return NextResponse.json({ success: true });
}
