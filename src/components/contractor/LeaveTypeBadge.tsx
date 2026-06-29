import type { LeaveTypeLabel } from '@/types/contractor';

const STYLES: Record<LeaveTypeLabel, { label: string; cls: string; short: string }> = {
  VL:             { label: 'Vacation',       short: 'VL', cls: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/40' },
  SL:             { label: 'Sick',           short: 'SL', cls: 'bg-sky-900/40 text-sky-300 border-sky-800/40' },
  MATERNITY:      { label: 'Maternity',      short: 'M',  cls: 'bg-pink-900/40 text-pink-300 border-pink-800/40' },
  PATERNITY:      { label: 'Paternity',      short: 'P',  cls: 'bg-violet-900/40 text-violet-300 border-violet-800/40' },
  PUBLIC_HOLIDAY: { label: 'Public holiday', short: 'PH', cls: 'bg-amber-900/40 text-amber-300 border-amber-800/40' },
  UNPAID:         { label: 'Unpaid',         short: 'U',  cls: 'bg-gray-800/60 text-gray-400 border-gray-700/40' },
};

export function LeaveTypeBadge({ type, days }: { type: LeaveTypeLabel | null; days?: number }) {
  if (!type) {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-red-900/30 text-red-300 border-red-800/40"
        title="Type not yet set — admin should classify"
      >
        ? unclassified
      </span>
    );
  }
  const style = STYLES[type];
  const dayLabel = days != null && days !== 1 ? ` × ${days}d` : '';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${style.cls}`}
      title={style.label}
    >
      {style.label}{dayLabel}
    </span>
  );
}
