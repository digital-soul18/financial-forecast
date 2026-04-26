import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type Params = Promise<{ id: string }>;

/** Admin-only: update a user (isActive toggle). */
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const currentUserId = req.headers.get('x-user-id') ?? '';

    // Prevent an admin from deactivating themselves
    if (id === currentUserId) {
      return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if ('isActive' in body) updates.isActive = Boolean(body.isActive);
    if ('name' in body && body.name) updates.name = String(body.name).trim();

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({ where: { id }, data: updates });
      // Keep contractor.isActive in sync when toggling user.isActive
      if ('isActive' in updates && u.role === 'contractor') {
        await tx.contractor.updateMany({
          where: { userId: id },
          data: { isActive: updates.isActive as boolean },
        });
      }
      return u;
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('PATCH /api/users/[id] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
