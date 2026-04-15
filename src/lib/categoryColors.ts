// Fixed color palette — colors never shift when categories change
export const CATEGORY_COLORS: Record<string, string> = {
  salaries_contractors: '#6366f1',   // indigo
  infrastructure_tools: '#0ea5e9',   // sky blue
  voice_ai: '#8b5cf6',               // violet
  bank_fees: '#94a3b8',              // slate
  legal_compliance: '#f59e0b',       // amber
  bookkeeping_accounting: '#10b981', // emerald
  marketing: '#f43f5e',              // rose
  rent_office: '#84cc16',            // lime
  insurance: '#14b8a6',              // teal
  other_expenses: '#6b7280',         // gray
  revenue: '#22c55e',                // green
  internal_transfers: '#d1d5db',     // light gray
};

export function getCategoryColor(slug: string): string {
  return CATEGORY_COLORS[slug] ?? '#6b7280';
}

export const CATEGORY_BG: Record<string, string> = {
  salaries_contractors: 'bg-indigo-100 text-indigo-800',
  infrastructure_tools: 'bg-sky-100 text-sky-800',
  voice_ai: 'bg-violet-100 text-violet-800',
  bank_fees: 'bg-slate-100 text-slate-700',
  legal_compliance: 'bg-amber-100 text-amber-800',
  bookkeeping_accounting: 'bg-emerald-100 text-emerald-800',
  marketing: 'bg-rose-100 text-rose-800',
  rent_office: 'bg-lime-100 text-lime-800',
  insurance: 'bg-teal-100 text-teal-800',
  other_expenses: 'bg-gray-100 text-gray-700',
  revenue: 'bg-green-100 text-green-800',
  internal_transfers: 'bg-gray-100 text-gray-600',
};

export function getCategoryBg(slug: string): string {
  return CATEGORY_BG[slug] ?? 'bg-gray-100 text-gray-700';
}
