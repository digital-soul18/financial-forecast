import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { inviteEmailHtml } from '@/lib/email/templates';

function serializeContractor(c: {
  id: string; userId: string; name: string; dailyRate: number; currency: string;
  startDate: Date; isActive: boolean; createdAt: Date; updatedAt: Date;
  user: { id: string; email: string; name: string | null; role: string; isActive: boolean; createdAt: Date };
}) {
  return {
    ...c,
    startDate: c.startDate.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    user: { ...c.user, createdAt: c.user.createdAt.toISOString() },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const contractors = await prisma.contractor.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ contractors: contractors.map(serializeContractor) });
  } catch (err) {
    console.error('GET /api/contractors error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email: rawEmail, dailyRate, startDate } = body;

    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!name || !email || !dailyRate || !startDate) {
      return NextResponse.json({ error: 'name, email, dailyRate, and startDate are required' }, { status: 400 });
    }

    // Check email not already in use
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    const contractor = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name, role: 'contractor', isActive: true },
      });
      return tx.contractor.create({
        data: {
          userId: user.id,
          name,
          dailyRate: Number(dailyRate),
          startDate: new Date(startDate),
          currency: 'AUD',
          isActive: true,
        },
        include: { user: true },
      });
    });

    // Send invite email — await so the caller knows if it failed
    const appUrl = process.env.APP_URL ?? '';
    let emailError: string | null = null;
    try {
      await sendEmail({
        to: contractor.user.email,
        subject: `You've been invited to the Voice AI Solutions Contractor Portal`,
        html: inviteEmailHtml({ name: contractor.name, appUrl }),
      });
    } catch (err) {
      emailError = String(err);
      console.error('Invite email failed:', err);
    }

    return NextResponse.json(
      { contractor: serializeContractor(contractor), emailError },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/contractors error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
