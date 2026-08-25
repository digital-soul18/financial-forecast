/**
 * Server-side glue: pulls a contractor + their leave history + forfeitures
 * from the DB, normalises into engine types, and returns a fully-computed
 * LeaveBalance. Keep all DB I/O in this file; src/lib/leave/balance.ts stays
 * pure for testability.
 */

import { prisma } from '@/lib/db';
import { computeBalance } from './balance';
import { classifyLeave } from './classifier';
import { computePeriodLeave, type PeriodLeaveBreakdown } from './period';
import { nswPublicHolidaysRange, publicHolidayDateSet } from './holidays';
import type {
  ForfeitureEvent,
  LeaveBalance,
  LeaveEvent,
  LeavePolicy,
  LeaveType,
} from './types';

/** Pre-compute a generous range once per process. */
const HOLIDAY_YEARS_FROM = 2024;
const HOLIDAY_YEARS_TO   = 2030;
let _holidayCache: Set<string> | null = null;
export function auHolidayDateSet(): Set<string> {
  if (!_holidayCache) {
    _holidayCache = publicHolidayDateSet(
      nswPublicHolidaysRange(HOLIDAY_YEARS_FROM, HOLIDAY_YEARS_TO),
    );
  }
  return _holidayCache;
}

interface ContractorRow {
  id: string;
  startDate: Date;
  probationMonths: number;
  accrualUsableDuringProbation: boolean;
  vlAccrualPerMonth: number;
  slAccrualPerMonth: number;
}

interface LeaveRow {
  leaveDate: Date;
  reason: string;
  status: string;
  leaveType: string | null;
  days: number;
}

interface ForfeitureRow {
  anniversaryDate: Date;
  vlForfeited: number;
  slForfeited: number;
}

function asPolicy(c: ContractorRow): LeavePolicy {
  return {
    startDate: c.startDate,
    probationMonths: c.probationMonths,
    accrualUsableDuringProbation: c.accrualUsableDuringProbation,
    vlAccrualPerMonth: c.vlAccrualPerMonth,
    slAccrualPerMonth: c.slAccrualPerMonth,
  };
}

/**
 * Convert a stored LeaveRequest row into a typed LeaveEvent.
 * If leaveType is null (legacy / un-typed rows), classify on the fly using the
 * reason text + AU holiday calendar.
 */
function toLeaveEvent(row: LeaveRow, holidays: Set<string>): LeaveEvent | null {
  // Only approved + taken-in-the-past leave deducts from balance.
  // Pending or denied requests do not.
  if (row.status !== 'approved') return null;

  let type: LeaveType | null = row.leaveType as LeaveType | null;
  if (!type) {
    type = classifyLeave(row.reason, row.leaveDate, holidays).type;
  }
  if (!type) return null; // un-classifiable → don't deduct (admin should review)

  return { date: row.leaveDate, type, days: row.days };
}

/**
 * Load everything the leave engines need for one contractor, in one round trip.
 *
 * `events` drops rows that can't be classified (they must not silently draw
 * from a pool). `unclassifiedEvents` keeps them separately so the payslip path
 * can still treat them as unpaid rather than accidentally paying for them.
 */
export async function loadLeaveContext(contractorId: string): Promise<{
  policy: LeavePolicy;
  events: LeaveEvent[];
  unclassifiedEvents: LeaveEvent[];
  forfeitures: ForfeitureEvent[];
}> {
  const c = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: {
      id: true,
      startDate: true,
      probationMonths: true,
      accrualUsableDuringProbation: true,
      vlAccrualPerMonth: true,
      slAccrualPerMonth: true,
    },
  });
  if (!c) throw new Error(`Contractor not found: ${contractorId}`);

  const [leaveRows, forfRows] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { contractorId },
      select: {
        leaveDate: true, reason: true, status: true,
        leaveType: true, days: true,
      },
    }),
    prisma.leaveForfeiture.findMany({
      where: { contractorId },
      select: { anniversaryDate: true, vlForfeited: true, slForfeited: true },
    }),
  ]);

  const holidays = auHolidayDateSet();
  const events: LeaveEvent[] = [];
  const unclassifiedEvents: LeaveEvent[] = [];

  for (const r of leaveRows) {
    const e = toLeaveEvent(r, holidays);
    if (e) { events.push(e); continue; }
    // Approved but unclassifiable — surfaced to the payslip path as UNPAID so
    // we never pay for a day nobody has categorised. Admin can reclassify.
    if (r.status === 'approved') {
      unclassifiedEvents.push({ date: r.leaveDate, type: 'UNPAID', days: r.days });
    }
  }

  const forfeitures: ForfeitureEvent[] = forfRows.map((f: ForfeitureRow) => ({
    anniversaryDate: f.anniversaryDate,
    vlForfeited: f.vlForfeited,
    slForfeited: f.slForfeited,
  }));

  return { policy: asPolicy(c), events, unclassifiedEvents, forfeitures };
}

export async function computeBalanceForContractor(
  contractorId: string,
  asOf: Date = new Date(),
): Promise<LeaveBalance> {
  const { policy, events, forfeitures } = await loadLeaveContext(contractorId);
  return computeBalance(policy, events, forfeitures, asOf);
}

/**
 * Resolve paid vs unpaid leave days for one calendar month. Used by the
 * payslip engine.
 */
export async function computePeriodLeaveForContractor(
  contractorId: string,
  month: number,
  year: number,
): Promise<PeriodLeaveBreakdown> {
  const { policy, events, unclassifiedEvents, forfeitures } =
    await loadLeaveContext(contractorId);

  const periodStart = new Date(year, month - 1, 1);
  const periodEnd   = new Date(year, month, 0);

  const breakdown = computePeriodLeave(
    policy,
    [...events, ...unclassifiedEvents],
    forfeitures,
    periodStart,
    periodEnd,
  );

  // Flag unclassified days that landed in this period so admin knows why pay
  // was reduced.
  const unclassifiedInPeriod = unclassifiedEvents.filter(
    (e) => e.date >= periodStart && e.date <= periodEnd,
  );
  for (const e of unclassifiedInPeriod) {
    breakdown.warnings.push(
      `${e.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}: leave type not set — treated as unpaid. Classify it to make it paid.`,
    );
  }

  return breakdown;
}
