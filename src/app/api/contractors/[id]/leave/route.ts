import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { classifyForCreate } from '@/lib/leave/createHelper';

type Params = Promise<{ id: string }>;

function serializeLeave(lr: {
  id: string; contractorId: string; leaveDate: Date; reason: string;
  status: string; adminNote: string | null;
  leaveType: string | null; days: number; classificationNote: string | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    ...lr,
    leaveDate: lr.leaveDate.toISOString(),
    createdAt: lr.createdAt.toISOString(),
    updatedAt: lr.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: { contractorId: id, ...(status ? { status } : {}) },
      orderBy: { leaveDate: 'desc' },
    });

    return NextResponse.json({ leaveRequests: leaveRequests.map(serializeLeave) });
  } catch (err) {
    console.error('GET /api/contractors/[id]/leave error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Admin manually adds a leave request for a contractor
export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const { leaveDate, reason, leaveType, days } = await req.json();

    if (!leaveDate || !reason) {
      return NextResponse.json({ error: 'leaveDate and reason are required' }, { status: 400 });
    }

    const leaveDateObj = new Date(leaveDate);
    const classified = classifyForCreate({
      leaveDate: leaveDateObj,
      reason,
      explicitType: leaveType ?? null,
      days,
    });

    const lr = await prisma.leaveRequest.create({
      data: {
        contractorId: id,
        leaveDate: leaveDateObj,
        reason,
        status: 'approved',
        leaveType: classified.leaveType,
        days: classified.days,
        classificationNote: classified.classificationNote,
      },
    });

    return NextResponse.json({ leaveRequest: serializeLeave(lr) }, { status: 201 });
  } catch (err) {
    console.error('POST /api/contractors/[id]/leave error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
