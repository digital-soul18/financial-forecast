import { NextRequest, NextResponse } from 'next/server';
import { generatePayslipForContractor, triggerMonthlyPayslips } from '@/lib/contractors/payslipEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { month, year, contractorId } = body;

    if (!month || !year) {
      return NextResponse.json({ error: 'month and year are required' }, { status: 400 });
    }

    if (contractorId) {
      // Generate for one specific contractor
      const result = await generatePayslipForContractor(contractorId, Number(month), Number(year));
      if (!result) {
        return NextResponse.json({
          message: 'No payslip generated (contractor inactive or not yet started)',
        });
      }
      return NextResponse.json({ generated: 1, payslipId: result.id, netAmount: result.netAmount });
    }

    // Generate for all active contractors
    // We reuse triggerMonthlyPayslips but it always uses current month;
    // for specific month/year we call generatePayslipForContractor directly
    const { prisma } = await import('@/lib/db');
    const contractors = await prisma.contractor.findMany({
      where: { isActive: true, user: { isActive: true } },
      select: { id: true },
    });

    let generated = 0;
    const errors: string[] = [];

    for (const c of contractors) {
      try {
        const result = await generatePayslipForContractor(c.id, Number(month), Number(year));
        if (result) generated++;
      } catch (err) {
        errors.push(`Contractor ${c.id}: ${String(err)}`);
      }
    }

    return NextResponse.json({ generated, total: contractors.length, errors });
  } catch (err) {
    console.error('POST /api/payslips/generate error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
