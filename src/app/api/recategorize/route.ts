import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { chunkForLLM } from '@/lib/categorization/batchCategorizer';
import { categorizeBatch } from '@/lib/categorization/claudeClient';

const CLAUDE_BATCH = 20;   // transactions per Claude API call
const DB_WRITE_EVERY = 5;  // write to DB every N Claude batches (= 100 rows)

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  console.log(`[recategorize ${ts}] ${msg}`);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const scope: string = body.scope ?? 'all';

  const where =
    scope === 'uncategorized'
      ? { category: null }
      : { NOT: { categorySource: 'manual' as const } };

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      id: true, date: true, amount: true,
      transactionDetails: true, merchantName: true,
      transactionType: true, source: true,
    },
    orderBy: { date: 'desc' },
  });

  const total = transactions.length;
  log(`Starting recategorization of ${total} transactions (scope=${scope})`);

  if (total === 0) {
    return new Response(
      JSON.stringify({ done: true, count: 0, message: 'Nothing to recategorize' }) + '\n',
      { headers: { 'Content-Type': 'application/x-ndjson' } },
    );
  }

  // Build inputs
  const inputs = chunkForLLM(
    transactions.map(t => ({
      ...t,
      date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
    })),
  );

  // Split into Claude-sized batches
  const batches: typeof inputs[number][][] = [];
  for (let i = 0; i < inputs.length; i += CLAUDE_BATCH) {
    batches.push(inputs.slice(i, i + CLAUDE_BATCH));
  }

  const totalBatches = batches.length;
  log(`Split into ${totalBatches} batches of up to ${CLAUDE_BATCH}`);

  // Streaming response using ReadableStream (NDJSON — one JSON line per event)
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      function send(obj: object) {
        controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'));
      }

      send({ type: 'start', total, totalBatches });

      let processed = 0;
      let failed = 0;
      const allUncertain: unknown[] = [];
      const pendingUpdates: Array<{ id: string; category: string; subcategory: string; confidence: number; rdEligible: boolean }> = [];

      const flush = async () => {
        if (pendingUpdates.length === 0) return;
        const count = pendingUpdates.length;
        log(`  Writing ${count} rows to DB…`);
        try {
          await prisma.$transaction(
            pendingUpdates.map(u =>
              prisma.transaction.update({
                where: { id: u.id },
                data: {
                  category: u.category,
                  subcategory: u.subcategory,
                  categorySource: 'llm',
                  categoryConfidence: u.confidence,
                  rdEligible: u.rdEligible,
                },
              }),
            ),
          );
          log(`  DB write OK (${count} rows)`);
        } catch (dbErr) {
          log(`  DB write FAILED: ${dbErr}`);
          send({ type: 'error', message: `DB write error: ${dbErr}` });
        }
        pendingUpdates.length = 0;
      };

      for (let bi = 0; bi < batches.length; bi++) {
        const batch = batches[bi];
        const batchNum = bi + 1;
        const globalStart = bi * CLAUDE_BATCH;

        log(`Batch ${batchNum}/${totalBatches} — rows ${globalStart + 1}–${globalStart + batch.length}`);
        send({ type: 'batch_start', batchNum, totalBatches, rowStart: globalStart + 1, rowEnd: globalStart + batch.length });

        try {
          // Re-index within batch
          const indexed = batch.map((t, idx) => ({ ...t, index: idx }));
          const results = await categorizeBatch(indexed);

          log(`  Batch ${batchNum} got ${results.length} results from Claude`);

          for (const r of results) {
            const tx = transactions[globalStart + r.index];
            if (!tx) continue;

            pendingUpdates.push({
              id: tx.id,
              category: r.category,
              subcategory: r.subcategory,
              confidence: r.confidence,
              rdEligible: r.rdEligible ?? false,
            });

            if (r.question) allUncertain.push({
              ...r,
              id: tx.id,
              date: tx.date instanceof Date ? tx.date.toISOString() : String(tx.date),
              amount: tx.amount,
              transactionDetails: tx.transactionDetails ?? null,
              merchantName: tx.merchantName ?? null,
            });
          }

          processed += results.length;
          send({ type: 'batch_done', batchNum, totalBatches, processed, total });

          // Flush to DB every DB_WRITE_EVERY batches or on last batch
          if ((batchNum % DB_WRITE_EVERY === 0) || batchNum === totalBatches) {
            send({ type: 'db_write', rows: pendingUpdates.length });
            await flush();
          }

        } catch (err) {
          failed += batch.length;
          const msg = String(err);
          const isApiKey = msg.includes('API key') || msg.includes('401') || msg.includes('authentication');
          log(`  Batch ${batchNum} FAILED: ${msg}`);
          send({ type: 'batch_error', batchNum, message: msg, isApiKeyError: isApiKey });

          // If it's an API key error, abort immediately
          if (isApiKey) {
            send({
              type: 'fatal',
              message: 'Invalid or missing Anthropic API key. Add ANTHROPIC_API_KEY to .env.local and restart the server.',
              isApiKeyError: true,
            });
            controller.close();
            return;
          }
        }
      }

      log(`Recategorization complete. processed=${processed}, failed=${failed}, uncertain=${allUncertain.length}`);
      send({ type: 'done', processed, failed, uncertain: allUncertain });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}
