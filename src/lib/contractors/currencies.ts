/** Currencies supported for contractor payment. Safe to import in client components. */
export const SUPPORTED_CURRENCIES = ['AUD', 'USD', 'PHP', 'GBP', 'EUR', 'NZD', 'SGD', 'INR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
