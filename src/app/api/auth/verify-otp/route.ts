import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateOtp } from '@/lib/auth/otp';
import { createSession } from '@/lib/auth/session';
import { triggerMonthlyPayslips } from '@/lib/contractors/payslipEngine';

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, code } = await req.json();
    const email = String(rawEmail ?? '').trim().toLowerCase();
    const otpCode = String(code ?? '').trim();

    if (!email || !otpCode) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await validateOtp(user.id, otpCode);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true, role: user.role });
    await createSession({ userId: user.id, email: user.email, role: user.role as 'admin' | 'contractor' }, res);

    // Auto-generate payslips on admin login on/after the 25th
    if (user.role === 'admin' && new Date().getDate() >= 25) {
      triggerMonthlyPayslips().catch((err) =>
        console.error('Auto payslip generation failed:', err),
      );
    }

    return res;
  } catch (err) {
    console.error('verify-otp error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
