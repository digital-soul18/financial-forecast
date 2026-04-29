import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ALLOWED_KEYS = ['approver_email', 'approver_name'];

export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany({ where: { key: { in: ALLOWED_KEYS } } });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return NextResponse.json({ settings: map });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const updates: Record<string, string> = {};
    for (const key of ALLOWED_KEYS) {
      if (key in body && typeof body[key] === 'string') updates[key] = body[key];
    }

    for (const [key, value] of Object.entries(updates)) {
      await prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }

    return NextResponse.json({ ok: true, updated: Object.keys(updates) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
