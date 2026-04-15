import { prisma } from '@/lib/db';
import type { ParsedTransaction } from '@/types/transaction';

export interface RuleMatch {
  category: string;
  subcategory?: string;
  ruleId: string;
}

export async function applyRules(transactions: ParsedTransaction[]): Promise<(RuleMatch | null)[]> {
  const rules = await prisma.categoryRule.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (rules.length === 0) return transactions.map(() => null);

  return transactions.map(tx => {
    const searchStr = [tx.transactionDetails, tx.merchantName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    for (const rule of rules) {
      if (searchStr.includes(rule.pattern.toLowerCase())) {
        return {
          category: rule.category,
          subcategory: rule.subcategory ?? undefined,
          ruleId: rule.id,
        };
      }
    }
    return null;
  });
}
