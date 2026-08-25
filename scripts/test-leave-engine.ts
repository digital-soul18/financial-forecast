/**
 * Validation script for the leave engine. Runs the two reference test cases
 * from the spec. Exits 0 on pass, non-zero on fail. No DB, no I/O.
 *
 * Run: npx tsx scripts/test-leave-engine.ts   (or via the npm script)
 */

import { computeBalance } from '../src/lib/leave/balance';
import { computePeriodLeave } from '../src/lib/leave/period';
import { classifyLeave } from '../src/lib/leave/classifier';
import { nswPublicHolidaysRange, publicHolidayDateSet } from '../src/lib/leave/holidays';
import type { LeaveEvent, LeavePolicy } from '../src/lib/leave/types';

const TOL = 0.01;
let failures = 0;

function check(label: string, actual: number, expected: number) {
  const ok = Math.abs(actual - expected) < TOL;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: actual=${actual.toFixed(4)}  expected=${expected.toFixed(2)}`);
  if (!ok) failures++;
}

function checkEq<T>(label: string, actual: T, expected: T) {
  const ok = actual === expected;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: actual=${String(actual)}  expected=${String(expected)}`);
  if (!ok) failures++;
}

// ── Holidays cache (used by classifier) ────────────────────────────────────
const HOLIDAYS = publicHolidayDateSet(nswPublicHolidaysRange(2025, 2028));

// ── Case 1: Stephanie Anne M. Vergara (PH) ─────────────────────────────────
console.log('\nCase 1: Stephanie Anne M. Vergara (PH) — as of 2026-06-29');

const STEPH_POLICY: LeavePolicy = {
  startDate: new Date(2025, 8, 15), // Sep 15 2025 (month is 0-indexed)
  probationMonths: 6,
  accrualUsableDuringProbation: false,
  vlAccrualPerMonth: 0.83,
  slAccrualPerMonth: 0.42,
};

const STEPH_EVENTS: LeaveEvent[] = [
  { date: new Date(2026, 3,  8), type: 'SL', days: 1 }, // Apr 8
  { date: new Date(2026, 4,  1), type: 'VL', days: 1 }, // May 1 — Mother's birthday, PH "Labour Day" is NOT AU
  { date: new Date(2026, 4, 28), type: 'VL', days: 1 }, // May 28
  { date: new Date(2026, 4, 29), type: 'VL', days: 1 }, // May 29
  { date: new Date(2026, 5, 15), type: 'SL', days: 1 }, // Jun 15
];

const STEPH_ASOF = new Date(2026, 5, 29); // Jun 29 2026
const stephResult = computeBalance(STEPH_POLICY, STEPH_EVENTS, [], STEPH_ASOF);

checkEq('completedMonths',  stephResult.completedMonths,  9);
check  ('VL accrued',       stephResult.vl.accrued,       7.47);
check  ('SL accrued',       stephResult.sl.accrued,       3.78);
check  ('VL used',          stephResult.vl.used,          3.00);
check  ('SL used',          stephResult.sl.used,          2.00);
check  ('VL forfeited',     stephResult.vl.forfeited,     0.00);
check  ('SL forfeited',     stephResult.sl.forfeited,     0.00);
check  ('VL available',     stephResult.vl.available,     4.47);
check  ('SL available',     stephResult.sl.available,     1.78);
checkEq('regularisationDate', stephResult.regularisationDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }), '2026-03-15');
checkEq('nextAnniversaryDate', stephResult.nextAnniversaryDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }), '2026-09-15');

// Classifier sanity for Steph's events
console.log('\n  Classifier checks for Steph events:');
checkEq('  Apr  8 "Sick leave"',     classifyLeave('Sick leave',         new Date(2026, 3,  8), HOLIDAYS).type, 'SL');
checkEq('  May  1 "Mother\'s b\'day"', classifyLeave("Mother's birthday", new Date(2026, 4,  1), HOLIDAYS).type, 'VL');
checkEq('  May 28 "Personal leave"', classifyLeave('Personal leave',     new Date(2026, 4, 28), HOLIDAYS).type, 'VL');
checkEq('  Jun 15 "Sick leave"',     classifyLeave('Sick leave',         new Date(2026, 5, 15), HOLIDAYS).type, 'SL');

// ── Case 2: Taresh Rajput (IN) ─────────────────────────────────────────────
console.log('\nCase 2: Taresh Rajput (IN) — as of 2026-06-29');

const TARESH_POLICY: LeavePolicy = {
  startDate: new Date(2025, 10, 1), // Nov 1 2025
  probationMonths: 3,
  accrualUsableDuringProbation: true,
  vlAccrualPerMonth: 0.83,
  slAccrualPerMonth: 0.42,
};

const tareshResult = computeBalance(TARESH_POLICY, [], [], STEPH_ASOF);
checkEq('completedMonths', tareshResult.completedMonths, 7);
check  ('VL accrued',      tareshResult.vl.accrued,      5.81);
check  ('SL accrued',      tareshResult.sl.accrued,      2.94);
check  ('VL available',    tareshResult.vl.available,    5.81); // no leave taken
check  ('SL available',    tareshResult.sl.available,    2.94);
checkEq('regularisationDate', tareshResult.regularisationDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }), '2026-02-01');
checkEq('nextAnniversaryDate', tareshResult.nextAnniversaryDate.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }), '2026-11-01');

// ── Edge case: probation lock for Steph at a pre-regularisation date ───────
console.log('\nEdge: Steph balance on 2026-01-15 (pre-regularisation)');
const stephEarly = computeBalance(STEPH_POLICY, [], [], new Date(2026, 0, 15));
checkEq('isLockedByProbation', stephEarly.isLockedByProbation, true);
check  ('VL accrued (still growing)', stephEarly.vl.accrued, 4 * 0.83); // 4 completed months Sep15→Jan15
check  ('VL available (locked)', stephEarly.vl.available, 0);

// ── Edge case: Taresh balance on 2025-12-15 (probation but accrual usable) ─
console.log('\nEdge: Taresh balance on 2025-12-15 (probation, but usable=true)');
const tareshEarly = computeBalance(TARESH_POLICY, [], [], new Date(2025, 11, 15));
checkEq('isLockedByProbation', tareshEarly.isLockedByProbation, false);
check  ('VL accrued', tareshEarly.vl.accrued, 1 * 0.83); // 1 completed month Nov1→Dec15
check  ('VL available (usable)', tareshEarly.vl.available, 1 * 0.83);

// ── Period leave → pay resolution (2026-06 cutover) ────────────────────────
console.log('\nPeriod pay resolution — Steph, May 2026 (3 VL days, balance ample)');
{
  const b = computePeriodLeave(
    STEPH_POLICY, STEPH_EVENTS, [],
    new Date(2026, 4, 1), new Date(2026, 4, 31),
  );
  check  ('total leave days', b.totalDays,  3);
  check  ('paid days',        b.paidDays,   3);   // covered by VL balance
  check  ('unpaid days',      b.unpaidDays, 0);   // → pay is NOT reduced
  check  ('VL drawn',         b.vlDrawn,    3);
}

console.log('\nPeriod pay resolution — public holiday never reduces pay');
{
  // 25 Dec 2026 is a Friday — a weekday AU public holiday.
  const events: LeaveEvent[] = [{ date: new Date(2026, 11, 25), type: 'PUBLIC_HOLIDAY', days: 1 }];
  const b = computePeriodLeave(
    STEPH_POLICY, events, [],
    new Date(2026, 11, 1), new Date(2026, 11, 31),
  );
  check  ('paid days',         b.paidDays,        1);
  check  ('unpaid days',       b.unpaidDays,      0);
  check  ('pool-neutral days', b.poolNeutralDays, 1);
  check  ('VL drawn (none)',   b.vlDrawn,         0);
}

console.log('\nPeriod pay resolution — half-day deducts 0.5, not 1.0');
{
  const events: LeaveEvent[] = [{ date: new Date(2026, 4, 5), type: 'UNPAID', days: 0.5 }];
  const b = computePeriodLeave(
    STEPH_POLICY, events, [],
    new Date(2026, 4, 1), new Date(2026, 4, 31),
  );
  check('unpaid days', b.unpaidDays, 0.5);
}

console.log('\nPeriod pay resolution — leave beyond balance spills to unpaid');
{
  // 12 VL days in one month against a ~7.5-day balance.
  const many: LeaveEvent[] = [];
  for (let d = 1; d <= 20 && many.length < 12; d++) {
    const date = new Date(2026, 5, d);
    if (date.getDay() >= 1 && date.getDay() <= 5) many.push({ date, type: 'VL', days: 1 });
  }
  const b = computePeriodLeave(
    STEPH_POLICY, many, [],
    new Date(2026, 5, 1), new Date(2026, 5, 30),
  );
  check  ('total days',  b.totalDays, 12);
  checkEq('some unpaid', b.unpaidDays > 0, true);
  checkEq('paid + unpaid == total', Math.abs(b.paidDays + b.unpaidDays - b.totalDays) < 0.001, true);
  checkEq('warning raised', b.warnings.length > 0, true);
}

console.log('\nPeriod pay resolution — pre-regularisation leave is unpaid (Steph)');
{
  const events: LeaveEvent[] = [{ date: new Date(2026, 0, 8), type: 'VL', days: 1 }]; // 8 Jan, before 15 Mar
  const b = computePeriodLeave(
    STEPH_POLICY, events, [],
    new Date(2026, 0, 1), new Date(2026, 0, 31),
  );
  check  ('unpaid days',    b.unpaidDays, 1);
  check  ('paid days',      b.paidDays,   0);
  checkEq('warning raised', b.warnings.length > 0, true);
}

console.log('\nPeriod pay resolution — Taresh CAN use credits during probation');
{
  const events: LeaveEvent[] = [{ date: new Date(2025, 11, 15), type: 'VL', days: 0.5 }]; // Dec 15, probation
  const b = computePeriodLeave(
    TARESH_POLICY, events, [],
    new Date(2025, 11, 1), new Date(2025, 11, 31),
  );
  check('paid days',   b.paidDays,   0.5); // 0.83 accrued covers 0.5
  check('unpaid days', b.unpaidDays, 0);
}

// ── Result ─────────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failures} TEST(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
