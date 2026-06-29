'use client';

/**
 * Reusable leave-balance card. Fetches /api/contractors/[id]/leave-balance
 * and renders the VL/SL pools, months-of-service progress, and next forfeiture
 * date. Used on the admin contractor detail page AND the contractor portal.
 */

import useSWR from 'swr';
import { Plane, Stethoscope, AlertTriangle, Calendar } from 'lucide-react';
import type { LeaveBalanceResponse } from '@/types/contractor';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const fmtDays = (n: number) => n.toFixed(2);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

interface PoolProps {
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  accent: string;
  available: number;
  accrued: number;
  used: number;
  forfeited: number;
  locked: boolean;
}

function PoolRow({ label, icon: Icon, accent, available, accrued, used, forfeited, locked }: PoolProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
        {locked && (
          <span className="ml-auto text-[10px] bg-amber-900/40 text-amber-300 border border-amber-700/30 px-1.5 py-0.5 rounded-full">
            Locked (probation)
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>
        {fmtDays(available)}
        <span className="text-xs text-gray-500 font-normal ml-1">days available</span>
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-500">
        <div><span className="block text-gray-400 tabular-nums">{fmtDays(accrued)}</span>accrued</div>
        <div><span className="block text-gray-400 tabular-nums">{fmtDays(used)}</span>used</div>
        <div><span className="block text-gray-400 tabular-nums">{fmtDays(forfeited)}</span>forfeited</div>
      </div>
    </div>
  );
}

interface Props {
  contractorId: string;
  /** When true, hide the admin-only hints (used in contractor portal). */
  readOnly?: boolean;
}

export default function LeaveBalanceCard({ contractorId, readOnly = false }: Props) {
  const { data, error, isLoading } = useSWR<{ balance: LeaveBalanceResponse }>(
    `/api/contractors/${contractorId}/leave-balance`,
    fetcher,
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm text-gray-500">
        Loading leave balance…
      </div>
    );
  }
  if (error || !data?.balance) {
    return (
      <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-5 text-sm text-red-300">
        Failed to load leave balance.
      </div>
    );
  }

  const b = data.balance;
  const months = b.completedMonths;
  const monthsToNext = b.monthsUntilNextAnniversary;
  const totalMonths = months + monthsToNext;
  const progressPct = totalMonths > 0 ? Math.min(100, (months / 12) * 100) : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Leave balance</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            As of {fmtDate(b.asOf)} · regularisation {fmtDate(b.regularisationDate)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-gray-500 justify-end">
            <Calendar className="w-3 h-3" />
            Next forfeiture
          </div>
          <p className="text-xs font-medium text-gray-300 mt-0.5">{fmtDate(b.nextAnniversaryDate)}</p>
        </div>
      </div>

      {/* Probation warning */}
      {b.isLockedByProbation && (
        <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/40 rounded-lg p-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Accrued credits are not yet usable — they unlock on {fmtDate(b.regularisationDate)} (end of probation).
            Leave taken before that date is treated as unpaid.
          </p>
        </div>
      )}

      {/* VL + SL pools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PoolRow
          label="Vacation (VL)"
          icon={Plane}
          accent="text-emerald-400"
          available={b.vl.available}
          accrued={b.vl.accrued}
          used={b.vl.used}
          forfeited={b.vl.forfeited}
          locked={b.isLockedByProbation}
        />
        <PoolRow
          label="Sick (SL)"
          icon={Stethoscope}
          accent="text-sky-400"
          available={b.sl.available}
          accrued={b.sl.accrued}
          used={b.sl.used}
          forfeited={b.sl.forfeited}
          locked={b.isLockedByProbation}
        />
      </div>

      {/* Months-of-service progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-500">Months of service this anniversary year</span>
          <span className="text-[11px] text-gray-400 tabular-nums">{months} of 12</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {!readOnly && (
        <p className="text-[10px] text-gray-600 leading-relaxed">
          VL accrues at {(b.vl.accrued / Math.max(1, months)).toFixed(2)}/mo · SL accrues at{' '}
          {(b.sl.accrued / Math.max(1, months)).toFixed(2)}/mo · all values are full-precision
          internally; display rounds to 2 dp.
        </p>
      )}
    </div>
  );
}
