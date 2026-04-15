import { parse } from 'date-fns';
import { parseCsv, makeHash } from './csvUtils';
import type { ParsedTransaction } from '@/types/transaction';

// NAB CSV columns (10 total, col index 3 is always empty):
// 0: Date, 1: Amount, 2: Account Number, 3: (empty), 4: Transaction Type,
// 5: Transaction Details, 6: Balance, 7: Category, 8: Merchant Name, 9: Processed On

export function parseNabCsv(csvText: string): ParsedTransaction[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  // Skip header row
  const dataRows = rows.slice(1);

  const transactions: ParsedTransaction[] = [];

  for (const row of dataRows) {
    if (row.length < 6) continue;

    const dateStr = row[0]?.trim() ?? '';
    const amountStr = row[1]?.trim() ?? '';
    const accountNumber = row[2]?.trim() ?? '';
    // col 3 intentionally skipped
    const transactionType = row[4]?.trim() ?? '';
    const transactionDetails = row[5]?.trim() ?? '';
    const balanceStr = row[6]?.trim() ?? '';
    const merchantName = row[8]?.trim() ?? '';
    const processedOnStr = row[9]?.trim() ?? '';

    if (!dateStr || !amountStr) continue;

    // Parse "DD MMM YY" → Date (e.g., "10 Apr 26")
    let date: Date;
    try {
      date = parse(dateStr, 'dd MMM yy', new Date());
      if (isNaN(date.getTime())) continue;
    } catch {
      continue;
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount)) continue;

    const balance = balanceStr ? parseFloat(balanceStr) : undefined;

    let processedOn: Date | undefined;
    if (processedOnStr) {
      try {
        const p = parse(processedOnStr, 'dd MMM yy', new Date());
        if (!isNaN(p.getTime())) processedOn = p;
      } catch { /* ignore */ }
    }

    const dedupHash = makeHash('nab', dateStr, amountStr, transactionDetails, accountNumber);

    transactions.push({
      source: 'nab',
      date,
      amount,
      balance,
      transactionType: transactionType || undefined,
      transactionDetails: transactionDetails || undefined,
      merchantName: merchantName || undefined,
      accountNumber: accountNumber || undefined,
      processedOn,
      dedupHash,
    });
  }

  return transactions;
}
