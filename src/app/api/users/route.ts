import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/sendEmail';
import { adminInviteEmailHtml, inviteEmailHtml } from '@/lib/email/templates';
import { getAppUrl } from '@/lib/appUrl';

/** Admin-only: list all users with their contractor profile (if any). */
export async function GET(req: NextRequest) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const currentUserId = req.headers.get('x-user-id') ?? '';

    const users = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        contractor: { select: { id: true, name: true, dailyRate: true, isActive: true } },
        sessions: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    return NextResponse.json({
      currentUserId,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.sessions[0]?.createdAt.toISOString() ?? null,
        contractorId: u.contractor?.id ?? null,
        contractorName: u.contractor?.name ?? null,
        dailyRate: u.contractor?.dailyRate ?? null,
      })),
    });
  } catch (err) {
    console.error('GET /api/users error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * Admin-only: create a new user (admin or contractor) and send an invite email.
 *
 * Body for admin:      { name, email, role: 'admin' }
 * Body for contractor: { name, email, role: 'contractor', dailyRate, startDate }
 */
export async function POST(req: NextRequest) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { role, name: rawName, email: rawEmail, dailyRate, startDate } = body;

    const name  = String(rawName  ?? '').trim();
    const email = String(rawEmail ?? '').trim().toLowerCase();

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
    }
    if (role !== 'admin' && role !== 'contractor') {
      return NextResponse.json({ error: 'role must be admin or contractor' }, { status: 400 });
    }
    if (role === 'contractor' && (!dailyRate || !startDate)) {
      return NextResponse.json({ error: 'dailyRate and startDate are required for contractors' }, { status: 400 });
    }

    // Ensure email is unique
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    const appUrl = getAppUrl();
    let emailError: string | null = null;

    if (role === 'admin') {
      const user = await prisma.user.create({
        data: { email, name, role: 'admin', isActive: true },
      });

      try {
        await sendEmail({
          to: email,
          subject: 'You\'ve been invited to Voice AI Solutions — Vantage Investor Portal',
          html: adminInviteEmailHtml({ name, appUrl }),
        });
      } catch (err) {
        emailError = String(err);
        console.error('Admin invite email failed:', err);
      }

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          contractorId: null,
        },
        emailError,
      }, { status: 201 });

    } else {
      // Contractor — same transaction as the existing /api/contractors POST
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

      try {
        await sendEmail({
          to: email,
          subject: `You've been invited to the Voice AI Solutions Contractor Portal`,
          html: inviteEmailHtml({ name, appUrl }),
        });
      } catch (err) {
        emailError = String(err);
        console.error('Contractor invite email failed:', err);
      }

      return NextResponse.json({
        user: {
          id: contractor.user.id,
          email: contractor.user.email,
          name: contractor.name,
          role: 'contractor',
          isActive: true,
          createdAt: contractor.createdAt.toISOString(),
          contractorId: contractor.id,
        },
        emailError,
      }, { status: 201 });
    }

  } catch (err) {
    console.error('POST /api/users error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
