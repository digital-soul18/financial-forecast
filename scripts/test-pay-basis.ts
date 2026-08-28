/**
 * Tests for the monthly-salary pay basis. Run: npm run test:pay
 */
import { resolvePayBasis } from '../src/lib/contractors/payBasis';

let fail = 0;
const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
function check(label: string, actual: number, expected: number) {
  const ok = near(actual, expected);
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${actual.toFixed(2)} (expected ${expected.toFixed(2)})`);
  if (!ok) fail++;
}
function checkEq<T>(label: string, a: T, b: T) {
  const ok = a === b;
  console.log(`  ${ok ? '✓' : '✗'} ${label}: ${String(a)} (expected ${String(b)})`);
  if (!ok) fail++;
}

const TARESH = {
  payModel: 'monthly',
  dailyRate: 227.28,
  monthlySalary: 5000,
  probationSalary: 4300,
  startDate: new Date(2025, 10, 1),  // 1 Nov 2025
  probationMonths: 3,                // regularises 1 Feb 2026
};

console.log('\nTaresh — flat 5,000 regardless of month length');
for (const [label, m, y, wd] of [['Apr (22d)', 4, 2026, 22], ['Aug (21d)', 8, 2026, 21], ['Jul (23d)', 7, 2026, 23]] as const) {
  const b = resolvePayBasis({ ...TARESH, workingDays: wd, periodMonth: m, periodYear: y });
  check(`${label} base`, b.baseAmount, 5000);
  check(`${label} day rate`, b.dayRate, 5000 / wd);
}

console.log('\nTaresh — probation months use 4,300');
{
  const b = resolvePayBasis({ ...TARESH, workingDays: 22, periodMonth: 12, periodYear: 2025 });
  check('Dec 2025 base', b.baseAmount, 4300);
}
console.log('\nTaresh — Feb 2026 (regularises on the 1st) uses 5,000');
{
  const b = resolvePayBasis({ ...TARESH, workingDays: 20, periodMonth: 2, periodYear: 2026 });
  check('Feb 2026 base', b.baseAmount, 5000);
}

console.log('\nMid-month regularisation straddle (Steph-shaped: 15 Mar)');
{
  // start 15 Sep 2025, 6mo probation -> regularises 15 Mar 2026.
  // Mar 2026 has 22 weekdays; 2-13 Mar = 10 before, 12 on/after.
  const b = resolvePayBasis({
    payModel: 'monthly', dailyRate: 0, monthlySalary: 65050, probationSalary: 60000,
    startDate: new Date(2025, 8, 15), probationMonths: 6,
    workingDays: 22, periodMonth: 3, periodYear: 2026,
  });
  const expected = (10 * 60000 + 12 * 65050) / 22;
  check('blended base', b.baseAmount, expected);
  checkEq('note emitted', b.notes.length > 0, true);
}

console.log('\nKaran — flat 1,700');
for (const [label, m, wd] of [['Apr (22d)', 4, 22], ['Aug (21d)', 8, 21]] as const) {
  const b = resolvePayBasis({
    payModel: 'monthly', dailyRate: 78.16, monthlySalary: 1700, probationSalary: null,
    startDate: new Date(2025, 9, 15), probationMonths: 6,
    workingDays: wd, periodMonth: m, periodYear: 2026,
  });
  check(`${label} base`, b.baseAmount, 1700);
}

console.log('\nDaily model unchanged (regression guard)');
{
  const b = resolvePayBasis({
    payModel: 'daily', dailyRate: 300, monthlySalary: null, probationSalary: null,
    startDate: new Date(2026, 3, 17), probationMonths: 6,
    workingDays: 21, periodMonth: 8, periodYear: 2026,
  });
  checkEq('model', b.model, 'daily');
  check('base', b.baseAmount, 6300);
  check('day rate', b.dayRate, 300);
}

console.log('\nSafety: monthly selected but salary missing → falls back to daily');
{
  const b = resolvePayBasis({
    payModel: 'monthly', dailyRate: 250, monthlySalary: null, probationSalary: null,
    startDate: new Date(2026, 0, 1), probationMonths: 6,
    workingDays: 20, periodMonth: 8, periodYear: 2026,
  });
  checkEq('model', b.model, 'daily');
  check('base', b.baseAmount, 5000);
  checkEq('warned', b.notes.length > 0, true);
}

console.log(`\n${fail === 0 ? '✅ ALL PAY-BASIS TESTS PASSED' : `❌ ${fail} FAILED`}\n`);
process.exit(fail === 0 ? 0 : 1);
