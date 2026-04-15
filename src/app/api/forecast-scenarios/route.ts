import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const scenarios = await prisma.forecastScenario.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true },
  });
  return NextResponse.json(scenarios);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name: string; snapshot: unknown[] };

  const scenario = await prisma.forecastScenario.create({
    data: {
      name: body.name,
      snapshot: JSON.stringify(body.snapshot),
    },
  });

  return NextResponse.json({ id: scenario.id, name: scenario.name, createdAt: scenario.createdAt });
}
