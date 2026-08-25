/**
 * Per-pay-period leave resolution. Decides, for each leave day in a period,
 * whether it is PAID (covered by accrued balance or a non-deducting type) or
 * UNPAID (reduces pay by one day rate).
 *
 * Implements spec §5 (deduction order) and §8.1 (pre-regularisation = unpaid).
 *
 * Pure — no DB. See server.ts for the DB-backed wrapper.
 */

import { computeBalance } from './balance';
import type {
  ForfeitureEvent,
  LeaveEvent,
  LeavePolicy,
} from './types';

export interface PeriodLeaveBreakdown {
  /** Every weekday leave day in the period, regardless of paid/unpaid. */
  totalDays: number;
  /** Days that do NOT reduce pay. */
  paidDays: number;
  /** Days that DO reduce pay (one day rate each). */
  unpaidDays: number;
  /** Days drawn from each pool (only counts covered days). */
  vlDrawn: number;
  slDrawn: number;
  /** Paid but pool-neutral (public holiday / maternity / paternity). */
  poolNeutralDays: number;
  /** Things the admin should look at. */
  warnings: string[];
}

/** Types that are paid but never draw from the VL/SL pools. */
const POOL_NEUTRAL = new Set(['PUBLIC_HOLIDAY', 'MATERNITY', 'PATERNITY']);

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

function fmt(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

/**
 * @param allEvents  ALL of the contractor's approved+typed leave events
 *                   (not just this period's) — needed to know how much of the
 *                   balance was already spent before this period opened.
 */
export function computePeriodLeave(
  policy: LeavePolicy,
  allEvents: LeaveEvent[],
  forfeitures: ForfeitureEvent[],
  periodStart: Date,
  periodEnd: Date,
): PeriodLeaveBreakdown {
  const out: PeriodLeaveBreakdown = {
    totalDays: 0,
    paidDays: 0,
    unpaidDays: 0,
    vlDrawn: 0,
    slDrawn: 0,
    poolNeutralDays: 0,
    warnings: [],
  };

  // Opening credits = everything accrued through period END, minus only the
  // leave taken BEFORE this period. This credits her with the accrual she
  // earns during the period, without double-counting this period's usage.
  const priorEvents = allEvents.filter((e) => e.date < periodStart);
  const opening = computeBalance(policy, priorEvents, forfeitures, periodEnd);

  let vlRemaining = Math.max(0, opening.vl.available);
  let slRemaining = Math.max(0, opening.sl.available);

  // Walk this period's weekday leave in date order so earlier days get first
  // claim on a shrinking balance.
  const periodEvents = allEvents
    .filter((e) => e.date >= periodStart && e.date <= periodEnd && isWeekday(e.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const e of periodEvents) {
    out.totalDays += e.days;

    // Pool-neutral paid types — never touch VL/SL, never reduce pay.
    if (POOL_NEUTRAL.has(e.type)) {
      out.paidDays += e.days;
      out.poolNeutralDays += e.days;
      continue;
    }

    // Explicitly unpaid.
    if (e.type === 'UNPAID') {
      out.unpaidDays += e.days;
      continue;
    }

    // Probation lock (spec §8.1) — accrued credits exist but aren't usable yet.
    const lockedOnThisDate =
      !policy.accrualUsableDuringProbation && e.date < opening.regularisationDate;
    if (lockedOnThisDate) {
      out.unpaidDays += e.days;
      out.warnings.push(
        `${fmt(e.date)}: taken before regularisation — unpaid (credits not yet usable).`,
      );
      continue;
    }

    // VL / SL — draw down what's covered, the remainder is unpaid.
    const pool = e.type === 'VL' ? 'VL' : 'SL';
    const remaining = pool === 'VL' ? vlRemaining : slRemaining;
    const covered = Math.min(e.days, remaining);
    const shortfall = e.days - covered;

    if (covered > 0) {
      out.paidDays += covered;
      if (pool === 'VL') { vlRemaining -= covered; out.vlDrawn += covered; }
      else               { slRemaining -= covered; out.slDrawn += covered; }
    }
    if (shortfall > 0) {
      out.unpaidDays += shortfall;
      out.warnings.push(
        pool === 'SL'
          // Spec §5.2 — SL overflow must not auto-spill into VL.
          ? `${fmt(e.date)}: ${shortfall.toFixed(2)}d sick leave beyond SL balance — treated as unpaid. Admin may convert to VL if desired.`
          : `${fmt(e.date)}: ${shortfall.toFixed(2)}d beyond VL balance — treated as unpaid.`,
      );
    }
  }

  return out;
}
