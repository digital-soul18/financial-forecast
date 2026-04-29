import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { regeneratePayslip } from '@/lib/contractors/payslipEngine';

type Params = Promise<{ id: string; payslipId: string }>;

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  try {
    const role = _req.headers.get('x-user-role');
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { payslipId } = await params;
    const result = await regeneratePayslip(payslipId);
    if (!result) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });

    const payslip = await prisma.payslip.findUnique({ where: { id: payslipId } });
    return NextResponse.json({
      payslip: {
        ...payslip,
        paidAt: payslip!.paidAt instanceof Date ? payslip!.paidAt.toISOString() : payslip!.paidAt,
        generatedAt: payslip!.generatedAt instanceof Date ? payslip!.generatedAt.toISOString() : payslip!.generatedAt,
      },
    });
  } catch (err) {
    console.error('POST /api/contractors/[id]/payslips/[payslipId] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  try {
    const { payslipId } = await params;
    const body = await req.json();
    const { paymentStatus, paidAmount } = body;

    if (!['pending', 'paid'].includes(paymentStatus)) {
      return NextResponse.json({ error: 'paymentStatus must be "pending" or "paid"' }, { status: 400 });
    }

    const data: Record<string, unknown> = { paymentStatus };
    if (paymentStatus === 'paid') {
      data.paidAt = new Date();
      if (paidAmount !== undefined) data.paidAmount = Number(paidAmount);
    } else {
      data.paidAt = null;
      data.paidAmount = null;
    }

    const payslip = await prisma.payslip.update({
      where: { id: payslipId },
      data,
    });

    return NextResponse.json({
      payslip: {
        ...payslip,
        paidAt: payslip.paidAt instanceof Date ? payslip.paidAt.toISOString() : payslip.paidAt,
        generatedAt: payslip.generatedAt instanceof Date ? payslip.generatedAt.toISOString() : payslip.generatedAt,
      },
    });
  } catch (err) {
    console.error('PATCH /api/contractors/[id]/payslips/[payslipId] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
