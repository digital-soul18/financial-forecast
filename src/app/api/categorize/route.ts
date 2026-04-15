import { NextRequest, NextResponse } from 'next/server';
import { chunkForLLM, categorizeAll } from '@/lib/categorization/batchCategorizer';
import { prisma } from '@/lib/db';

interface UncategorizedTransaction {
  id: string;
  date: Date | string;
  amount: number;
  transactionDetails: string | null;
  merchantName: string | null;
  transactionType: string | null;
  source: string;
}

export async function POST(req: NextRequest) {
  try {
    const { transactions } = (await req.json()) as { transactions: UncategorizedTransaction[] };

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const inputs = chunkForLLM(transactions.map(t => ({
      ...t,
      date: typeof t.date === 'string' ? t.date : t.date.toISOString(),
    })));

    const results = await categorizeAll(inputs);

    // Save back to DB
    const updates = results.map((r, i) =>
      prisma.transaction.update({
        where: { id: transactions[r.index ?? i]?.id },
        data: {
          category: r.category,
          subcategory: r.subcategory,
          categorySource: 'llm',
          categoryConfidence: r.confidence,
          rdEligible: r.rdEligible ?? false,
        },
      }),
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ results });
  } catch (err) {
    const msg = String(err);
    const isApiKey =
      msg.includes('API key') || msg.includes('401') || msg.includes('authentication');
    console.error('Categorize error:', msg);
    return NextResponse.json(
      { error: msg, isApiKeyError: isApiKey },
      { status: isApiKey ? 401 : 500 },
    );
  }
}
