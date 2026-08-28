/**
 * Resolves the pay basis for one payslip period — the base amount for the
 * month and the effective day rate used for unpaid-leave deductions and
 * overtime.
 *
 * Two models:
 *   daily   — legacy. base = workingDays × dailyRate. Pay swings with how many
 *             weekdays the month happens to have (20–23).
 *   monthly — base = the contracted flat monthly salary, independent of the
 *             calendar. Day rate is derived as base ÷ workingDaysInMonth,
 *             matching the leave spec §5 (day_rate = monthly_net_pay /
 *             working_days_in_month).
 *
 * A period that straddles the regularisation date is pro-rated across the
 * probation and post-probation salaries by working days.
 */

import { regularisationDate } from '@/lib/leave/balance';
import { splitWorkingDaysAtDate } from './workingDays';

export interface PayBasisInput {
  payModel: string;
  dailyRate: number;
  monthlySalary: number | null;
  probationSalary: number | null;
  startDate: Date;
  probationMonths: number;
  workingDays: number;
  periodMonth: number;
  periodYear: number;
}

export interface PayBasis {
  model: 'daily' | 'monthly';
  /** Full base pay for the month before any leave deduction. */
  baseAmount: number;
  /** Per-working-day value, used for unpaid leave and the OT hourly rate. */
  dayRate: number;
  /** The monthly salary applied (0 for the daily model). Stored for audit. */
  baseSalary: number;
  notes: string[];
}

export function resolvePayBasis(i: PayBasisInput): PayBasis {
  const notes: string[] = [];

  // Daily model, or monthly selected without a salary set — fall back to the
  // legacy behaviour rather than paying someone zero.
  if (i.payModel !== 'monthly' || i.monthlySalary == null) {
    if (i.payModel === 'monthly' && i.monthlySalary == null) {
      notes.push('payModel is "monthly" but monthlySalary is not set — fell back to daily rate.');
    }
    return {
      model: 'daily',
      baseAmount: i.workingDays * i.dailyRate,
      dayRate: i.dailyRate,
      baseSalary: 0,
      notes,
    };
  }

  const postSalary = i.monthlySalary;
  const probSalary = i.probationSalary ?? postSalary;

  let baseSalary = postSalary;
  if (probSalary !== postSalary) {
    const regDate = regularisationDate(i.startDate, i.probationMonths);
    const { before, after } = splitWorkingDaysAtDate(
      i.periodMonth, i.periodYear, i.startDate, regDate,
    );
    if (before > 0 && after > 0) {
      // Straddles regularisation — blend by working days.
      baseSalary = (before * probSalary + after * postSalary) / (before + after);
      notes.push(
        `Period straddles regularisation: ${before}d at ${probSalary} + ${after}d at ${postSalary}.`,
      );
    } else if (before > 0) {
      baseSalary = probSalary;
    }
  }

  return {
    model: 'monthly',
    baseAmount: baseSalary,
    dayRate: i.workingDays > 0 ? baseSalary / i.workingDays : 0,
    baseSalary,
    notes,
  };
}
