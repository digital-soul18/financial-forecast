import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const payslips = await prisma.payslip.findMany({
      where: { contractorId: id },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });

    return NextResponse.json({
      payslips: payslips.map((p) => ({
        ...p,
        paidAt: p.paidAt instanceof Date ? p.paidAt.toISOString() : p.paidAt,
        generatedAt: p.generatedAt instanceof Date ? p.generatedAt.toISOString() : p.generatedAt,
      })),
    });
  } catch (err) {
    console.error('GET /api/contractors/[id]/payslips error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
