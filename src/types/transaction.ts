export type TransactionSource = 'nab' | 'wise';
export type CategorySource = 'llm' | 'manual' | 'rule' | 'csv_import';

export interface Transaction {
  id: string;
  source: TransactionSource;
  uploadId?: string | null;
  date: string; // ISO string
  amount: number;
  balance?: number | null;
  transactionType?: string | null;
  transactionDetails?: string | null;
  merchantName?: string | null;
  accountNumber?: string | null;
  category?: string | null;
  subcategory?: string | null;
  categorySource?: CategorySource | null;
  categoryConfidence?: number | null;
  dedupHash?: string | null;
  rdEligible: boolean;
  rdPercentage?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  processedOn?: string | null;
  attachments?: TransactionAttachment[];
}

export interface TransactionAttachment {
  id: string;
  transactionId: string;
  filename: string;
  storedPath: string;
  fileSize?: number | null;
  uploadedAt: string;
}

export interface RawNabRow {
  date: string;
  amount: string;
  accountNumber: string;
  transactionType: string;
  transactionDetails: string;
  balance: string;
  category: string;
  merchantName: string;
  processedOn: string;
}

export interface RawWiseRow {
  id: string;
  status: string;
  direction: string;
  createdOn: string;
  finishedOn: string;
  sourceFeeAmount: string;
  sourceFeeCurrency: string;
  targetFeeAmount: string;
  targetFeeCurrency: string;
  sourceName: string;
  sourceAmount: string;
  sourceCurrency: string;
  targetName: string;
  targetAmount: string;
  targetCurrency: string;
  exchangeRate: string;
  reference: string;
  batch: string;
  createdBy: string;
  category: string;
  note: string;
}

export interface ParsedTransaction {
  source: TransactionSource;
  date: Date;
  amount: number;
  balance?: number;
  transactionType?: string;
  transactionDetails?: string;
  merchantName?: string;
  accountNumber?: string;
  processedOn?: Date;
  dedupHash: string;
  /** Wise-specific enrichment — only present on Wise OUT transactions */
  wiseDetails?: {
    wiseId: string;
    targetName: string;
    targetAmount: number;
    targetCurrency: string;
    sourceCurrency: string;
    sourceFeeAmount: number;   // fee charged by Wise (same currency as source)
    sourceFeeCurrency: string;
    reference: string;
  };
}
