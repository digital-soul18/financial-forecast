// Admin-side: add / list overtime for a specific contractor
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type Params = Promise<{ id: string }>;

function serialize(o: {
  id: string; contractorId: string; overtimeDate: Date; hours: number; reason: string;
  status: string; adminNote: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    ...o,
    overtimeDate: o.overtimeDate.toISOString(),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id: contractorId } = await params;
    const rows = await prisma.overtimeRequest.findMany({
      where: { contractorId },
      orderBy: { overtimeDate: 'desc' },
    });
    return NextResponse.json({ overtimeRequests: rows.map(serialize) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const role = req.headers.get('x-user-role');
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: contractorId } = await params;
    const { overtimeDate, hours, reason } = await req.json();

    if (!overtimeDate || !hours || !reason) {
      return NextResponse.json({ error: 'overtimeDate, hours, and reason are required' }, { status: 400 });
    }

    const ot = await prisma.overtimeRequest.create({
      data: {
        contractorId,
        overtimeDate: new Date(overtimeDate),
        hours: Number(hours),
        reason,
        status: 'pending',
      },
    });

    return NextResponse.json({ overtimeRequest: serialize(ot) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
