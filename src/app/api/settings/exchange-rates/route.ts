import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SUPPORTED_CURRENCIES } from '@/lib/contractors/currencies';

export async function GET() {
  try {
    const rows = await prisma.exchangeRate.findMany({ orderBy: { currency: 'asc' } });
    return NextResponse.json({ rates: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    const email = req.headers.get('x-user-email') ?? 'admin';
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json() as Record<string, number>;

    const results: { currency: string; rateToAud: number }[] = [];
    for (const [currency, rateToAud] of Object.entries(body)) {
      if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency) || currency === 'AUD') continue;
      if (typeof rateToAud !== 'number' || rateToAud <= 0) continue;

      const row = await prisma.exchangeRate.upsert({
        where: { currency },
        create: { currency, rateToAud, updatedBy: email },
        update: { rateToAud, updatedBy: email },
      });
      results.push(row);
    }

    return NextResponse.json({ updated: results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
