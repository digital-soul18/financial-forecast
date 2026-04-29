import { prisma } from '@/lib/db';
/** Default fallback rates (AUD as base) — updated by admin via Settings */
const DEFAULTS: Record<string, number> = {
  USD: 1.57,  // 1 USD ≈ 1.57 AUD
  PHP: 0.027, // 1 PHP ≈ 0.027 AUD (≈ 37 PHP/AUD)
  GBP: 2.02,  // 1 GBP ≈ 2.02 AUD
  EUR: 1.73,  // 1 EUR ≈ 1.73 AUD
  NZD: 0.91,  // 1 NZD ≈ 0.91 AUD
  SGD: 1.17,  // 1 SGD ≈ 1.17 AUD
  INR: 0.018, // 1 INR ≈ 0.018 AUD
};

/**
 * Get the AUD exchange rate for a given currency.
 * Returns 1 for AUD. Reads from DB, falls back to hardcoded defaults.
 */
export async function getExchangeRate(currency: string): Promise<number> {
  if (!currency || currency === 'AUD') return 1;

  const row = await prisma.exchangeRate.findUnique({ where: { currency } });
  if (row) return row.rateToAud;

  return DEFAULTS[currency] ?? 1;
}

// Note: SUPPORTED_CURRENCIES lives in ./currencies.ts (client-safe)
