'use client';

/**
 * Clickable wrapper around <LeaveTypeBadge> that lets an admin reclassify a
 * leave request. Renders the badge by default; on click, opens a small popover
 * with the type choices. Selecting an option PATCHes /api/leave/[id] with
 * {leaveType: ...} and calls onChanged() so the parent can re-fetch.
 *
 * Used in the admin contractor detail page; the read-only badge is still used
 * verbatim in the contractor portal.
 */

import { useEffect, useRef, useState } from 'react';
import { LeaveTypeBadge } from './LeaveTypeBadge';
import type { LeaveTypeLabel } from '@/types/contractor';
import { ChevronDown } from 'lucide-react';

const CHOICES: { value: LeaveTypeLabel | null; label: string; hint?: string }[] = [
  { value: 'VL',             label: 'Vacation',       hint: 'Deducts from VL pool' },
  { value: 'SL',             label: 'Sick',           hint: 'Deducts from SL pool' },
  { value: 'PUBLIC_HOLIDAY', label: 'Public holiday', hint: 'Paid · no deduction' },
  { value: 'MATERNITY',      label: 'Maternity',      hint: 'Separate bucket · no VL/SL hit' },
  { value: 'PATERNITY',      label: 'Paternity',      hint: 'Separate bucket · no VL/SL hit' },
  { value: 'UNPAID',         label: 'Unpaid',         hint: 'No pool · day rate deducted from pay' },
  { value: null,             label: '? Unclassified', hint: 'Clear classification' },
];

interface Props {
  leaveId: string;
  currentType: LeaveTypeLabel | null;
  days?: number;
  /** Called after a successful PATCH so the parent re-fetches. */
  onChanged?: () => void;
}

export function LeaveTypeEditor({ leaveId, currentType, days, onChanged }: Props) {
  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function pick(t: LeaveTypeLabel | null) {
    if (t === currentType) { setOpen(false); return; }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/leave/${leaveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveType: t }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity disabled:opacity-50"
        title="Click to change type"
      >
        <LeaveTypeBadge type={currentType} days={days} />
        <ChevronDown className="w-3 h-3 text-gray-500" />
      </button>

      {open && (
        <div className="absolute z-30 left-0 mt-1 min-w-[220px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-1">
          {CHOICES.map((c) => {
            const isCurrent = c.value === currentType;
            return (
              <button
                key={c.value ?? 'null'}
                type="button"
                onClick={() => pick(c.value)}
                disabled={busy}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-violet-950/40 text-violet-200'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="font-medium">{c.label}</span>
                {c.hint && <span className="text-[10px] text-gray-500">{c.hint}</span>}
              </button>
            );
          })}
          {error && (
            <p className="text-[11px] text-red-400 px-2.5 py-1.5">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
