import { prisma } from '@/lib/db';

/**
 * Last-resort hardcoded fallbacks (AUD as base: 1 unit = X AUD).
 * Only used if both the live API and DB-configured rates fail.
 */
const DEFAULTS: Record<string, number> = {
  USD: 1.57,
  PHP: 0.027,
  GBP: 2.02,
  EUR: 1.73,
  NZD: 0.91,
  SGD: 1.17,
  INR: 0.018,
};

/**
 * In-process cache for live Frankfurter rates.
 * Keyed by currency code. TTL: 1 hour.
 * Avoids hitting the API on every payslip in a batch run.
 */
const liveCache = new Map<string, { rateToAud: number; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch the live rate for `currency` from Frankfurter (ECB data).
 * Returns `null` on any network/parse error so the caller can fall back.
 *
 * Frankfurter returns "1 AUD = X <currency>", so we invert to get
 * "1 <currency> = X AUD" (rateToAud).
 */
async function fetchLiveRate(currency: string): Promise<number | null> {
  const cached = liveCache.get(currency);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rateToAud;
  }

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=AUD&to=${currency}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;

    const data = await res.json() as { rates?: Record<string, number> };
    const audPerUnit = data.rates?.[currency]; // 1 AUD = audPerUnit <currency>
    if (!audPerUnit || audPerUnit <= 0) return null;

    const rateToAud = 1 / audPerUnit; // 1 <currency> = rateToAud AUD
    liveCache.set(currency, { rateToAud, fetchedAt: Date.now() });
    return rateToAud;
  } catch {
    return null; // timeout, network error, parse error — fall through
  }
}

/**
 * Get the AUD exchange rate for a given currency.
 * Resolution order:
 *   1. Live Frankfurter API (ECB data, cached 1 h)
 *   2. Admin-configured rate in DB (Settings → Exchange Rates)
 *   3. Hardcoded fallback defaults
 */
export async function getExchangeRate(currency: string): Promise<number> {
  if (!currency || currency === 'AUD') return 1;

  // 1. Live rate
  const live = await fetchLiveRate(currency);
  if (live !== null) return live;

  // 2. DB-configured fallback
  const row = await prisma.exchangeRate.findUnique({ where: { currency } });
  if (row) return row.rateToAud;

  // 3. Hardcoded last resort
  return DEFAULTS[currency] ?? 1;
}

// Note: SUPPORTED_CURRENCIES lives in ./currencies.ts (client-safe)
