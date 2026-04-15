import { parseISO } from 'date-fns';
import { parseCsv, makeHash } from './csvUtils';
import type { ParsedTransaction } from '@/types/transaction';

// Wise CSV columns:
// ID, Status, Direction, Created on, Finished on, Source fee amount, Source fee currency,
// Target fee amount, Target fee currency, Source name, Source amount (after fees), Source currency,
// Target name, Target amount (after fees), Target currency, Exchange rate, Reference, Batch,
// Created by, Category, Note

export function parseWiseCsv(csvText: string): ParsedTransaction[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const idIdx               = col('id');
  const statusIdx           = col('status');
  const directionIdx        = col('direction');
  const createdOnIdx        = col('created on');
  const sourceFeeAmountIdx  = col('source fee amount');
  const sourceFeeCurrencyIdx = col('source fee currency');
  const sourceAmountIdx     = col('source amount (after fees)');
  const sourceCurrencyIdx   = col('source currency');
  const targetNameIdx       = col('target name');
  const targetAmountIdx     = col('target amount (after fees)');
  const targetCurrencyIdx   = col('target currency');
  const referenceIdx        = col('reference');
  const sourceNameIdx       = col('source name');

  const dataRows = rows.slice(1);
  const transactions: ParsedTransaction[] = [];

  for (const row of dataRows) {
    const status = row[statusIdx]?.trim() ?? '';
    if (status === 'REFUNDED') continue;

    const id                = row[idIdx]?.trim() ?? '';
    const direction         = row[directionIdx]?.trim() ?? '';
    const createdOnStr      = row[createdOnIdx]?.trim() ?? '';
    const sourceFeeAmountStr = row[sourceFeeAmountIdx]?.trim() ?? '0';
    const sourceFeeCurrency = row[sourceFeeCurrencyIdx]?.trim() ?? '';
    const sourceAmountStr   = row[sourceAmountIdx]?.trim() ?? '';
    const sourceCurrency    = row[sourceCurrencyIdx]?.trim() ?? '';
    const targetName        = row[targetNameIdx]?.trim() ?? '';
    const targetAmountStr   = row[targetAmountIdx]?.trim() ?? '';
    const targetCurrency    = row[targetCurrencyIdx]?.trim() ?? '';
    const reference         = row[referenceIdx]?.trim() ?? '';
    const sourceName        = row[sourceNameIdx]?.trim() ?? '';

    if (!createdOnStr || !sourceAmountStr) continue;

    // Wise datetimes are UTC ("2026-04-07 03:41:52").
    // Parse as UTC explicitly so the date stored in the DB is correct UTC,
    // matching how NAB date-only values are stored (midnight UTC).
    let date: Date;
    try {
      date = new Date(createdOnStr.replace(' ', 'T') + 'Z'); // force UTC
      if (isNaN(date.getTime())) continue;
    } catch {
      continue;
    }

    const netAmount = parseFloat(sourceAmountStr);
    if (isNaN(netAmount)) continue;

    const sourceFeeAmount = parseFloat(sourceFeeAmountStr) || 0;
    const targetAmount    = parseFloat(targetAmountStr) || 0;

    // The stored amount is the net transfer (after fees) — negative for OUT
    const amount = direction === 'OUT' ? -netAmount : netAmount;

    const transactionDetails = reference || targetName || id;
    const merchantName = direction === 'OUT' ? targetName : sourceName;

    const dedupHash = makeHash('wise', createdOnStr, sourceAmountStr, direction, id);

    const tx: ParsedTransaction = {
      source: 'wise',
      date,
      amount,
      transactionType: direction,
      transactionDetails: transactionDetails || undefined,
      merchantName: merchantName || undefined,
      accountNumber: id,
      dedupHash,
    };

    // Attach Wise-specific details for OUT transfers so the upload route
    // can match against NAB transactions and enrich their notes instead of
    // creating a duplicate record.
    if (direction === 'OUT') {
      tx.wiseDetails = {
        wiseId: id,
        targetName,
        targetAmount,
        targetCurrency,
        sourceCurrency,
        sourceFeeAmount,
        sourceFeeCurrency,
        reference,
      };
    }

    transactions.push(tx);
  }

  return transactions;
}
