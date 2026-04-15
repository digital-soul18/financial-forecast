import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAllSubcategories } from '@/lib/categoryConstants';

export async function GET() {
  const configs = await prisma.subcategoryRdConfig.findMany();
  const allSubcats = getAllSubcategories();

  // Merge with defaults
  const result = allSubcats.map(s => {
    const saved = configs.find(c => c.category === s.categorySlug && c.subcategory === s.slug);
    return {
      category: s.categorySlug,
      subcategory: s.slug,
      label: s.label,
      rdPercent: saved?.rdPercent ?? s.defaultRdPercent,
      id: saved?.id ?? null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const updates = body as Array<{ category: string; subcategory: string; rdPercent: number }>;

  const ops = updates.map(u =>
    prisma.subcategoryRdConfig.upsert({
      where: { category_subcategory: { category: u.category, subcategory: u.subcategory } },
      create: { category: u.category, subcategory: u.subcategory, rdPercent: u.rdPercent },
      update: { rdPercent: u.rdPercent },
    }),
  );

  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
