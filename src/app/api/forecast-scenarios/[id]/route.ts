import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.forecastScenario.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// PATCH /api/forecast-scenarios/[id] — update snapshot (and optionally name) in place
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as { name?: string; snapshot?: unknown[] };
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.snapshot !== undefined) data.snapshot = JSON.stringify(body.snapshot);
  const updated = await prisma.forecastScenario.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, createdAt: updated.createdAt });
}

// POST /api/forecast-scenarios/[id]/restore — replaces all current overrides with snapshot
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenario = await prisma.forecastScenario.findUnique({ where: { id } });
  if (!scenario) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const snapshot = JSON.parse(scenario.snapshot) as Array<{
    category: string;
    subcategory: string;
    customLabel: string | null;
    month: string;
    amount: number;
  }>;

  // Clear all current overrides, then insert snapshot
  await prisma.forecastOverride.deleteMany();
  if (snapshot.length > 0) {
    await prisma.$transaction(
      snapshot.map(s =>
        prisma.forecastOverride.create({
          data: {
            category: s.category,
            subcategory: s.subcategory,
            customLabel: s.customLabel ?? null,
            month: s.month,
            amount: s.amount,
          },
        }),
      ),
    );
  }

  return NextResponse.json({ success: true, count: snapshot.length });
}
