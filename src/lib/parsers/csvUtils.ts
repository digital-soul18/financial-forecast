import Papa from 'papaparse';
import crypto from 'node:crypto';
import type { TransactionSource } from '@/types/transaction';

export function detectSource(csvText: string): TransactionSource {
  const firstLine = csvText.split('\n')[0] ?? '';
  if (firstLine.includes('Direction') && firstLine.includes('Target name')) return 'wise';
  return 'nab';
}

export function parseCsv(csvText: string): string[][] {
  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });
  return result.data;
}

export function makeHash(...parts: (string | number | undefined | null)[]): string {
  return crypto
    .createHash('sha256')
    .update(parts.map(p => String(p ?? '')).join('|'))
    .digest('hex')
    .slice(0, 32);
}
