/**
 * Count Mon–Fri working days between two dates (inclusive on both ends).
 */
export function countWorkingDays(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cur <= end) {
    const day = cur.getDay(); // 0=Sun, 6=Sat
    if (day >= 1 && day <= 5) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Calculate working days for a payslip period.
 * Pro-rates from the contractor's startDate if they started mid-month.
 * Returns 0 if the contractor hasn't started yet this period.
 */
export function getPayslipWorkingDays(
  periodMonth: number, // 1–12
  periodYear: number,
  contractorStartDate: Date,
): number {
  const periodStart = new Date(periodYear, periodMonth - 1, 1);   // 1st of month
  const periodEnd = new Date(periodYear, periodMonth, 0);          // last day of month

  const start = new Date(contractorStartDate);
  start.setHours(0, 0, 0, 0);

  // Contractor hasn't started yet
  if (start > periodEnd) return 0;

  // Use the later of period start or contractor start date
  const effectiveStart = start > periodStart ? start : periodStart;

  return countWorkingDays(effectiveStart, periodEnd);
}

/*
 * getApprovedLeaveDays() was removed in the 2026-06 leave cutover.
 *
 * It counted leave ROWS (.length) rather than summing `days`, so half-days
 * deducted a full day's pay, and it ignored `leaveType` entirely, so public
 * holidays and maternity/paternity leave also reduced pay.
 *
 * Paid-vs-unpaid resolution now lives in src/lib/leave/period.ts, which is
 * balance-aware (only days beyond the accrued balance reduce pay) and
 * type-aware. Use computePeriodLeaveForContractor() from src/lib/leave/server.
 */
