import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** Admin-only: list all users with their contractor profile (if any). */
export async function GET(req: NextRequest) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const currentUserId = req.headers.get('x-user-id') ?? '';

    const users = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: { contractor: { select: { id: true, name: true, dailyRate: true, isActive: true } } },
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
