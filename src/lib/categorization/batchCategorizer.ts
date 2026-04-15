import { categorizeBatch, type TransactionInput, type CategorizationResult } from './claudeClient';

const BATCH_SIZE = 20;

export interface CategorizeBatchOptions {
  onProgress?: (done: number, total: number) => void;
}

export async function categorizeAll(
  transactions: TransactionInput[],
  options: CategorizeBatchOptions = {},
): Promise<CategorizationResult[]> {
  const results: CategorizationResult[] = [];
  const total = transactions.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    // Re-index within batch
    const indexed = batch.map((t, idx) => ({ ...t, index: idx }));
    const batchResults = await categorizeBatch(indexed);

    // Map back to global indices
    for (const r of batchResults) {
      results.push({ ...r, index: i + r.index });
    }

    options.onProgress?.(Math.min(i + BATCH_SIZE, total), total);
  }

  return results;
}

export function chunkForLLM(
  transactions: Array<{ id: string; date: string; amount: number; transactionDetails?: string | null; merchantName?: string | null; transactionType?: string | null; source: string }>,
): TransactionInput[] {
  return transactions.map((t, index) => ({
    index,
    date: t.date,
    amount: t.amount,
    details: t.transactionDetails ?? undefined,
    merchant: t.merchantName ?? undefined,
    type: t.transactionType ?? undefined,
    source: t.source,
  }));
}
