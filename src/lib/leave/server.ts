/**
 * Server-side glue: pulls a contractor + their leave history + forfeitures
 * from the DB, normalises into engine types, and returns a fully-computed
 * LeaveBalance. Keep all DB I/O in this file; src/lib/leave/balance.ts stays
 * pure for testability.
 */

import { prisma } from '@/lib/db';
import { computeBalance } from './balance';
import { classifyLeave } from './classifier';
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

export async function computeBalanceForContractor(
  contractorId: string,
  asOf: Date = new Date(),
): Promise<LeaveBalance> {
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
  const events = leaveRows
    .map((r) => toLeaveEvent(r, holidays))
    .filter((e): e is LeaveEvent => e !== null);

  const forfeitures: ForfeitureEvent[] = forfRows.map((f: ForfeitureRow) => ({
    anniversaryDate: f.anniversaryDate,
    vlForfeited: f.vlForfeited,
    slForfeited: f.slForfeited,
  }));

  return computeBalance(asPolicy(c), events, forfeitures, asOf);
}
