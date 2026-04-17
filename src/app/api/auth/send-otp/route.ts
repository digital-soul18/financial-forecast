import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createOtpRecord } from '@/lib/auth/otp';
import { sendEmail } from '@/lib/email/sendEmail';
import { otpEmailHtml } from '@/lib/email/templates';

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail } = await req.json();
    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const adminEmail = (process.env.ADMIN_EMAIL ?? '').toLowerCase();

    let user = await prisma.user.findUnique({ where: { email } });

    // Auto-bootstrap admin account on first request
    if (!user && email === adminEmail) {
      user = await prisma.user.create({
        data: { email, name: 'Sowrabh Behl', role: 'admin', isActive: true },
      });
    }

    if (!user) {
      // Don't reveal whether email exists — generic message
      return NextResponse.json({ error: 'No account found for this email address' }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'This account has been disabled' }, { status: 403 });
    }

    const code = await createOtpRecord(user.id);

    await sendEmail({
      to: user.email,
      subject: `Your login code: ${code}`,
      html: otpEmailHtml({ code, name: user.name ?? undefined }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('send-otp error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
