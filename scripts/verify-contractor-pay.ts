/**
 * Verification harness — recomputes a contractor's leave balance and, for each
 * existing payslip, what the pay figures SHOULD be under the current engine.
 *
 * Read-only. Reads via the `sqlite3` CLI rather than Prisma so it works against
 * any snapshot without needing the native better-sqlite3 binary to match your
 * CPU architecture.
 *
 *   npx tsx scripts/verify-contractor-pay.ts <db-path> [name-filter]
 */

import { execFileSync } from 'node:child_process';
import { computeBalance } from '../src/lib/leave/balance';
import { computePeriodLeave } from '../src/lib/leave/period';
import { classifyLeave } from '../src/lib/leave/classifier';
import { nswPublicHolidaysRange, publicHolidayDateSet } from '../src/lib/leave/holidays';
import type { LeaveEvent, LeavePolicy, LeaveType } from '../src/lib/leave/types';

const dbPath = process.argv[2];
const nameFilter = process.argv[3] ?? '';
if (!dbPath) {
  console.error('Usage: npx tsx scripts/verify-contractor-pay.ts <db-path> [name-filter]');
  process.exit(1);
}

const HOURS_PER_DAY = 8;
const HOLIDAYS = publicHolidayDateSet(nswPublicHolidaysRange(2024, 2030));
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const iso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
const money = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function q<T>(sql: string): T[] {
  const out = execFileSync('sqlite3', ['-json', dbPath, sql], { encoding: 'utf8' }).trim();
  return out ? (JSON.parse(out) as T[]) : [];
}
/** SQLite stores DATETIME as ISO text; parse to a local-midnight Date. */
function d(s: string): Date {
  const [y, m, day] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day);
}

interface CRow {
  id: string; name: string; dailyRate: number; currency: string; startDate: string;
  probationMonths: number; country: string; accrualUsableDuringProbation: number;
  vlAccrualPerMonth: number; slAccrualPerMonth: number; otMultiplier: number;
}
interface LRow { leaveDate: string; reason: string; status: string; leaveType: string | null; days: number }
interface PRow {
  periodMonth: number; periodYear: number; workingDays: number; leaveDays: number;
  overtimeHours: number; netAmount: number; paymentStatus: string; paidLeaveDays: number;
}
interface ORow { overtimeDate: string; hours: number }

const contractors = q<CRow>(
  `SELECT id,name,dailyRate,currency,startDate,probationMonths,country,
          accrualUsableDuringProbation,vlAccrualPerMonth,slAccrualPerMonth,otMultiplier
   FROM Contractor ${nameFilter ? `WHERE name LIKE '%${nameFilter.replace(/'/g, "''")}%'` : ''}
   ORDER BY name`,
);

if (contractors.length === 0) { console.log(`No contractor matching "${nameFilter}"`); process.exit(0); }

for (const c of contractors) {
  const rate = c.dailyRate;
  const otMult = c.otMultiplier ?? 1;
  const otRate = (rate / HOURS_PER_DAY) * otMult;

  const policy: LeavePolicy = {
    startDate: d(c.startDate),
    probationMonths: c.probationMonths,
    accrualUsableDuringProbation: !!c.accrualUsableDuringProbation,
    vlAccrualPerMonth: c.vlAccrualPerMonth,
    slAccrualPerMonth: c.slAccrualPerMonth,
  };

  const leaveRows = q<LRow>(
    `SELECT leaveDate,reason,status,leaveType,days FROM LeaveRequest WHERE contractorId='${c.id}' ORDER BY leaveDate`,
  );
  const otRows = q<ORow>(
    `SELECT overtimeDate,hours FROM OvertimeRequest WHERE contractorId='${c.id}' AND status='approved'`,
  );
  const payslips = q<PRow>(
    `SELECT periodMonth,periodYear,workingDays,leaveDays,overtimeHours,netAmount,paymentStatus,
            COALESCE(paidLeaveDays,0) AS paidLeaveDays
     FROM Payslip WHERE contractorId='${c.id}' ORDER BY periodYear,periodMonth`,
  );

  // Classify (mirrors what the app does at read time for legacy null rows)
  const events: LeaveEvent[] = [];
  for (const r of leaveRows) {
    if (r.status !== 'approved') continue;
    const date = d(r.leaveDate);
    const type = (r.leaveType as LeaveType | null) ?? classifyLeave(r.reason, date, HOLIDAYS).type ?? 'UNPAID';
    events.push({ date, type, days: r.days ?? 1 });
  }

  console.log(`\n${'═'.repeat(76)}`);
  console.log(`${c.name} · ${c.currency} ${money(rate)}/day · started ${c.startDate.slice(0, 10)} · OT ×${otMult}`);
  console.log('═'.repeat(76));

  const bal = computeBalance(policy, events, [], new Date());
  console.log(`\nLEAVE BALANCE (today)   completed months: ${bal.completedMonths}`);
  console.log(`  regularisation ${iso(bal.regularisationDate)} · next forfeiture ${iso(bal.nextAnniversaryDate)}`);
  console.log(`  VL  accrued ${bal.vl.accrued.toFixed(2)}  used ${bal.vl.used.toFixed(2)}  →  available ${bal.vl.available.toFixed(2)}`);
  console.log(`  SL  accrued ${bal.sl.accrued.toFixed(2)}  used ${bal.sl.used.toFixed(2)}  →  available ${bal.sl.available.toFixed(2)}`);

  if (payslips.length === 0) { console.log('\n(no payslips)'); continue; }

  console.log(`\nPAYSLIP RE-VERIFICATION`);
  let totalDelta = 0;

  for (const p of payslips) {
    const leave = computePeriodLeave(
      policy, events, [],
      new Date(p.periodYear, p.periodMonth - 1, 1),
      new Date(p.periodYear, p.periodMonth, 0),
    );
    const otActual = otRows
      .filter((o) => { const od = d(o.overtimeDate); return od.getFullYear() === p.periodYear && od.getMonth() + 1 === p.periodMonth; })
      .reduce((s, o) => s + o.hours, 0);

    const billable = p.workingDays - leave.unpaidDays;
    const expected = billable * rate + otActual * otRate;
    const delta = expected - p.netAmount;
    totalDelta += delta;

    const ok = Math.abs(delta) < 0.01;
    console.log(`\n  ${ok ? '✓' : '⚠'} ${MONTHS[p.periodMonth]} ${p.periodYear}  [${p.paymentStatus}]  stored net ${c.currency} ${money(p.netAmount)}`);
    console.log(`      working ${p.workingDays}d · leave ${leave.totalDays}d (paid ${leave.paidDays} / unpaid ${leave.unpaidDays}) · billable ${billable}d`);
    if (p.overtimeHours !== otActual) {
      console.log(`      ⚠ OT MISMATCH: payslip has ${p.overtimeHours}h but ${otActual}h are approved for this period`);
    } else {
      console.log(`      OT ${otActual}h @ ${c.currency} ${money(otRate)}/h = ${c.currency} ${money(otActual * otRate)}`);
    }
    if (!ok) console.log(`      → should be ${c.currency} ${money(expected)}   delta ${delta >= 0 ? '+' : ''}${money(delta)}`);
    for (const w of leave.warnings) console.log(`      ⚠ ${w}`);
  }

  console.log(`\n  ${'-'.repeat(58)}`);
  console.log(`  TOTAL DELTA ACROSS ALL PAYSLIPS: ${c.currency} ${totalDelta >= 0 ? '+' : ''}${money(totalDelta)}`);
  console.log(`  (positive = owed to her once payslips are recalculated)`);
}
