/**
 * Pure leave-balance engine. All inputs are passed in; no DB / time / I/O.
 *
 * Reference test cases (validate against `scripts/test-leave-engine.ts`):
 *   • Steph (PH, start 2025-09-15, probation 6mo, locked-during-probation)
 *     as_of 2026-06-29 → completedMonths=9, VL=4.47 available, SL=1.78 available
 *   • Taresh (IN, start 2025-11-01, probation 3mo, usable-during-probation)
 *     as_of 2026-06-29 → completedMonths=7, VL=5.81 available, SL=2.94 available
 */

import type {
  ForfeitureEvent,
  LeaveBalance,
  LeaveEvent,
  LeavePolicy,
  PoolBalance,
} from './types';

// ── Date helpers (UTC-stable; never use .getDate()/.getMonth() naively) ────

/**
 * Treat all input dates as calendar days (ignore TZ). This matches the spec —
 * "1st of the month" means the calendar 1st in the employee's timezone, not
 * a UTC instant.
 */
function ymd(d: Date): { y: number; m: number; d: number } {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

function makeDate(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d);
}

// ── Core calculations ──────────────────────────────────────────────────────

/**
 * Completed months between two dates. A month counts as "completed" only when
 * the same day-of-month is reached or passed. Spec section 3.1.
 *
 *   start = 2025-09-15, asOf = 2026-06-29 → 9
 *   start = 2025-09-15, asOf = 2026-07-14 → 9 (10th ticks over on 2026-07-15)
 */
export function completedMonthsOfService(startDate: Date, asOf: Date): number {
  const s = ymd(startDate);
  const a = ymd(asOf);
  let months = (a.y - s.y) * 12 + (a.m - s.m);
  if (a.d < s.d) months -= 1;
  return Math.max(0, months);
}

/** start_date + probationMonths (calendar months). */
export function regularisationDate(startDate: Date, probationMonths: number): Date {
  const s = ymd(startDate);
  // Note: JS Date addition handles month overflow naturally (e.g. Nov + 3 = Feb)
  return makeDate(s.y, s.m + probationMonths, s.d);
}

/**
 * Anniversary at or AFTER asOf — the next forfeiture date. If asOf is the
 * anniversary itself, that anniversary qualifies (today's forfeiture, if any,
 * has not yet happened until end of day).
 */
export function nextAnniversaryDate(startDate: Date, asOf: Date): Date {
  const s = ymd(startDate);
  const a = ymd(asOf);
  // The next anniversary is the start_date with the year set such that the
  // resulting date is the smallest date >= asOf.
  let year = a.y;
  let candidate = makeDate(year, s.m, s.d);
  if (candidate < asOf) {
    year += 1;
    candidate = makeDate(year, s.m, s.d);
  }
  return candidate;
}

export function monthsBetween(from: Date, to: Date): number {
  return completedMonthsOfService(from, to);
}

/**
 * Sum days from events that fall AT OR BEFORE asOf, matching the given type.
 * Half-day events are honoured via `event.days`.
 */
function usedFor(
  events: LeaveEvent[],
  type: 'VL' | 'SL',
  asOf: Date,
): number {
  let total = 0;
  for (const e of events) {
    if (e.type !== type) continue;
    if (e.date > asOf) continue; // future leave doesn't deduct yet (spec 8.2)
    total += e.days;
  }
  return total;
}

function forfeitedFor(
  forfeitures: ForfeitureEvent[],
  type: 'VL' | 'SL',
  asOf: Date,
): number {
  let total = 0;
  for (const f of forfeitures) {
    if (f.anniversaryDate > asOf) continue;
    total += type === 'VL' ? f.vlForfeited : f.slForfeited;
  }
  return total;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function computeBalance(
  policy: LeavePolicy,
  events: LeaveEvent[],
  forfeitures: ForfeitureEvent[],
  asOf: Date,
): LeaveBalance {
  const completedMonths = completedMonthsOfService(policy.startDate, asOf);
  const regDate = regularisationDate(policy.startDate, policy.probationMonths);
  const nextAnniv = nextAnniversaryDate(policy.startDate, asOf);

  const vlAccrued = completedMonths * policy.vlAccrualPerMonth;
  const slAccrued = completedMonths * policy.slAccrualPerMonth;

  const vlUsed = usedFor(events, 'VL', asOf);
  const slUsed = usedFor(events, 'SL', asOf);

  const vlForfeit = forfeitedFor(forfeitures, 'VL', asOf);
  const slForfeit = forfeitedFor(forfeitures, 'SL', asOf);

  const isLockedByProbation =
    !policy.accrualUsableDuringProbation && asOf < regDate;

  const vl: PoolBalance = {
    accrued:   vlAccrued,
    used:      vlUsed,
    forfeited: vlForfeit,
    available: isLockedByProbation ? 0 : vlAccrued - vlUsed - vlForfeit,
  };
  const sl: PoolBalance = {
    accrued:   slAccrued,
    used:      slUsed,
    forfeited: slForfeit,
    available: isLockedByProbation ? 0 : slAccrued - slUsed - slForfeit,
  };

  return {
    asOf,
    completedMonths,
    regularisationDate: regDate,
    nextAnniversaryDate: nextAnniv,
    monthsUntilNextAnniversary: monthsBetween(asOf, nextAnniv),
    isLockedByProbation,
    vl,
    sl,
  };
}

/** Convenience: 2-decimal display rounding. Do NOT use this internally. */
export function displayDays(n: number): string {
  return n.toFixed(2);
}
