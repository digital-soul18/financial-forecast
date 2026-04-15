import { NextRequest, NextResponse } from 'next/server';
import { detectSource } from '@/lib/parsers/csvUtils';
import { parseNabCsv } from '@/lib/parsers/nabParser';
import { parseWiseCsv } from '@/lib/parsers/wiseParser';
import { prisma } from '@/lib/db';
import { applyRules } from '@/lib/categorization/rulesEngine';
import type { ParsedTransaction } from '@/types/transaction';

// ── Wise notes helpers ─────────────────────────────────────────────────────────

/** Build a human-readable notes string for a matched Wise transfer */
function buildWiseNote(d: NonNullable<ParsedTransaction['wiseDetails']>): string {
  const parts: string[] = [];
  if (d.targetName) parts.push(`Sent to ${d.targetName}`);
  if (d.targetAmount && d.targetCurrency) {
    parts.push(`${d.targetAmount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${d.targetCurrency}`);
  }
  if (d.sourceCurrency && d.sourceCurrency !== 'AUD') parts.push(`from ${d.sourceCurrency}`);
  if (d.reference) parts.push(`ref: ${d.reference}`);
  // Embed Wise ID so we can detect re-uploads and avoid double-annotating
  parts.push(`[Wise:${d.wiseId}]`);
  return parts.join(' · ');
}

/**
 * The NAB debit for a Wise transfer = net amount (after Wise fees) + Wise fee.
 * Both must be in the same currency (e.g. AUD) to be addable.
 */
function grossMatchAmount(wd: NonNullable<ParsedTransaction['wiseDetails']>, netAmount: number): number {
  // netAmount is already negative for OUT. Fee makes the debit larger (more negative).
  if (wd.sourceFeeCurrency && wd.sourceCurrency && wd.sourceFeeCurrency === wd.sourceCurrency) {
    return netAmount - wd.sourceFeeAmount; // e.g. -500 - 5 = -505
  }
  return netAmount; // currencies differ — fall back to net only
}

// ── Date-window helper ─────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const csvText = await file.text();
    const source = detectSource(csvText);
    const parsed = source === 'nab' ? parseNabCsv(csvText) : parseWiseCsv(csvText);

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No transactions found in file' }, { status: 422 });
    }

    // Create upload record
    const upload = await prisma.upload.create({
      data: { filename: file.name, source, rowCount: parsed.length, status: 'parsing' },
    });

    // ── Wise: match against existing NAB transactions ────────────────────────
    if (source === 'wise') {
      let matched = 0;
      let inserted = 0;
      const savedIds: string[] = [];

      for (const t of parsed) {
        // Only try to match OUT transactions (debits from NAB)
        if (t.wiseDetails) {
          const wd = t.wiseDetails;
          const wiseTag = `[Wise:${wd.wiseId}]`;

          // Search window: ±2 days around the Wise transaction date
          const windowStart = addDays(t.date, -2);
          const windowEnd   = addDays(t.date,  2);

          // NAB debits the gross amount (net transfer + Wise fee), so match on that.
          const nabAmount = grossMatchAmount(wd, t.amount);

          // Fetch NAB candidates: match on gross amount within ±2-day window.
          // The window covers UTC→AEDT timezone shifts (up to +11h) and any
          // 1-day processing delays on NAB's side.
          const candidates = await prisma.transaction.findMany({
            where: {
              source: 'nab',
              amount: nabAmount,
              date: { gte: windowStart, lte: windowEnd },
            },
            orderBy: { date: 'asc' },
          });

          // Re-upload guard: if any candidate already has this Wise tag, skip
          if (candidates.some(c => c.notes?.includes(wiseTag))) {
            matched++;
            continue;
          }

          const nabMatch = candidates[0] ?? null;

          if (nabMatch) {
            // Annotate the NAB transaction with Wise details
            const wiseNote = buildWiseNote(wd);
            const updatedNotes = nabMatch.notes
              ? `${nabMatch.notes}\n${wiseNote}`
              : wiseNote;

            await prisma.transaction.update({
              where: { id: nabMatch.id },
              data: { notes: updatedNotes },
            });

            // Clean up any orphaned standalone Wise record that was created
            // for this transfer in a previous upload (before matching worked)
            const orphan = await prisma.transaction.findUnique({
              where: { dedupHash: t.dedupHash },
              select: { id: true },
            });
            if (orphan) {
              await prisma.transaction.delete({ where: { id: orphan.id } });
            }

            matched++;
          } else {
            // No NAB match — upsert a Wise transaction record with notes populated.
            // Use upsert so that re-uploads of previously-imported records still
            // get their notes filled in (handles the case where the record was
            // created before the notes feature existed).
            const rule = (await applyRules([t]))[0];
            const wiseNote = buildWiseNote(wd);
            const existing = await prisma.transaction.findUnique({
              where: { dedupHash: t.dedupHash },
              select: { id: true, notes: true },
            });
            if (existing) {
              // Already exists — top up notes if missing
              if (!existing.notes) {
                await prisma.transaction.update({
                  where: { id: existing.id },
                  data: { notes: wiseNote },
                });
              }
              // Count as matched (no new record) so the UI feedback is accurate
              matched++;
            } else {
              try {
                const tx = await prisma.transaction.create({
                  data: {
                    source: 'wise',
                    uploadId: upload.id,
                    date: t.date,
                    amount: t.amount,
                    transactionType: t.transactionType ?? null,
                    transactionDetails: t.transactionDetails ?? null,
                    merchantName: t.merchantName ?? null,
                    accountNumber: t.accountNumber ?? null,
                    category: rule?.category ?? null,
                    subcategory: rule?.subcategory ?? null,
                    categorySource: rule ? 'rule' : null,
                    categoryConfidence: rule ? 1.0 : null,
                    dedupHash: t.dedupHash,
                    notes: wiseNote,
                  },
                });
                savedIds.push(tx.id);
                inserted++;
              } catch {
                // Concurrent duplicate — ignore
              }
            }
          }
        } else {
          // Wise IN transaction — create as normal
          try {
            const rule = (await applyRules([t]))[0];
            const tx = await prisma.transaction.create({
              data: {
                source: 'wise',
                uploadId: upload.id,
                date: t.date,
                amount: t.amount,
                transactionType: t.transactionType ?? null,
                transactionDetails: t.transactionDetails ?? null,
                merchantName: t.merchantName ?? null,
                accountNumber: t.accountNumber ?? null,
                category: rule?.category ?? null,
                subcategory: rule?.subcategory ?? null,
                categorySource: rule ? 'rule' : null,
                categoryConfidence: rule ? 1.0 : null,
                dedupHash: t.dedupHash,
              },
            });
            savedIds.push(tx.id);
            inserted++;
          } catch {
            // Duplicate
          }
        }
      }

      await prisma.upload.update({
        where: { id: upload.id },
        data: { status: 'complete', completedAt: new Date(), rowCount: inserted + matched },
      });

      const uncategorized = savedIds.length > 0
        ? await prisma.transaction.findMany({
            where: { id: { in: savedIds }, category: null },
            select: { id: true, date: true, amount: true, transactionDetails: true, merchantName: true, transactionType: true, source: true },
          })
        : [];

      return NextResponse.json({
        uploadId: upload.id,
        source,
        inserted,
        matched,
        skipped: parsed.length - inserted - matched,
        uncategorized,
      });
    }

    // ── NAB (and any other source): original path ────────────────────────────
    const ruleMatches = await applyRules(parsed);

    let inserted = 0;
    const savedIds: string[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const t = parsed[i];
      const rule = ruleMatches[i];

      try {
        const tx = await prisma.transaction.create({
          data: {
            source: t.source,
            uploadId: upload.id,
            date: t.date,
            amount: t.amount,
            balance: t.balance ?? null,
            transactionType: t.transactionType ?? null,
            transactionDetails: t.transactionDetails ?? null,
            merchantName: t.merchantName ?? null,
            accountNumber: t.accountNumber ?? null,
            category: rule?.category ?? null,
            subcategory: rule?.subcategory ?? null,
            categorySource: rule ? 'rule' : null,
            categoryConfidence: rule ? 1.0 : null,
            dedupHash: t.dedupHash,
            processedOn: t.processedOn ?? null,
          },
        });
        savedIds.push(tx.id);
        inserted++;
      } catch {
        // Duplicate dedupHash → skip
      }
    }

    await prisma.upload.update({
      where: { id: upload.id },
      data: { status: 'complete', completedAt: new Date(), rowCount: inserted },
    });

    const uncategorized = await prisma.transaction.findMany({
      where: { uploadId: upload.id, category: null },
      select: { id: true, date: true, amount: true, transactionDetails: true, merchantName: true, transactionType: true, source: true },
    });

    return NextResponse.json({
      uploadId: upload.id,
      source,
      inserted,
      skipped: parsed.length - inserted,
      uncategorized,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
