import { prisma } from '@/lib/db';
import { getPayslipWorkingDays } from './workingDays';
import { computePeriodLeaveForContractor } from '@/lib/leave/server';
import { getExchangeRate } from './fx';
import { sendEmail } from '@/lib/email/sendEmail';
import { payslipEmailHtml } from '@/lib/email/templates';
import { getAppUrl } from '@/lib/appUrl';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Hours per workday for overtime rate calculation */
const HOURS_PER_DAY = 8;

/** Approved overtime hours for a contractor in a given month/year */
function getApprovedOvertimeHours(
  overtimeRequests: { overtimeDate: Date; hours: number; status: string }[],
  month: number,
  year: number,
): number {
  return overtimeRequests
    .filter((o) => {
      if (o.status !== 'approved') return false;
      const d = new Date(o.overtimeDate);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .reduce((sum, o) => sum + o.hours, 0);
}

/**
 * Generate a payslip for a single contractor for a given month/year.
 * Idempotent — returns existing payslip if already generated.
 * Returns null if contractor is inactive or hasn't started yet.
 */
export async function generatePayslipForContractor(
  contractorId: string,
  month: number,
  year: number,
): Promise<{ id: string; netAmount: number; netAmountAud: number } | null> {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: {
      user: true,
      leaveRequests: {
        where: { status: 'approved' },
        select: { leaveDate: true, status: true },
      },
      overtimeRequests: {
        where: { status: 'approved' },
        select: { overtimeDate: true, hours: true, status: true },
      },
    },
  });

  if (!contractor || !contractor.isActive || !contractor.user.isActive) return null;

  // Idempotent — return existing
  const existing = await prisma.payslip.findUnique({
    where: {
      contractorId_periodMonth_periodYear: { contractorId, periodMonth: month, periodYear: year },
    },
  });
  if (existing) return { id: existing.id, netAmount: existing.netAmount, netAmountAud: existing.netAmountAud };

  const workingDays = getPayslipWorkingDays(month, year, contractor.startDate);
  if (workingDays === 0) return null;

  // Leave: only days NOT covered by accrued balance reduce pay. Paid VL/SL,
  // public holidays and maternity/paternity leave the pay untouched.
  const leave = await computePeriodLeaveForContractor(contractorId, month, year);
  const leaveDays = leave.totalDays;
  const paidLeaveDays = leave.paidDays;
  const unpaidLeaveDays = leave.unpaidDays;
  const billableDays = Math.max(0, workingDays - unpaidLeaveDays);
  const dailyRateSnap = contractor.dailyRate;
  const grossAmount = workingDays * dailyRateSnap;
  const deductions = unpaidLeaveDays * dailyRateSnap;

  // Overtime — multiplier is 1.0 (straight time) unless set per contractor.
  const otMultiplierSnap = contractor.otMultiplier ?? 1;
  const overtimeHours = getApprovedOvertimeHours(contractor.overtimeRequests, month, year);
  const overtimeAmount = overtimeHours * (dailyRateSnap / HOURS_PER_DAY) * otMultiplierSnap;

  const netAmount = (billableDays * dailyRateSnap) + overtimeAmount;

  if (leave.warnings.length > 0) {
    console.warn(`[PayslipEngine] ${contractor.name} ${MONTH_NAMES[month]} ${year}:`, leave.warnings);
  }

  // FX conversion
  const currency = contractor.currency ?? 'AUD';
  const currencySnapRate = await getExchangeRate(currency);
  const netAmountAud = netAmount * currencySnapRate;

  const payslip = await prisma.payslip.create({
    data: {
      contractorId,
      periodMonth: month,
      periodYear: year,
      workingDays,
      leaveDays,
      paidLeaveDays,
      unpaidLeaveDays,
      billableDays,
      dailyRateSnap,
      grossAmount,
      deductions,
      overtimeHours,
      overtimeAmount,
      otMultiplierSnap,
      netAmount,
      currency,
      currencySnapRate,
      netAmountAud,
      paymentStatus: 'pending',
    },
  });

  // Send payslip email
  const appUrl = getAppUrl();
  sendEmail({
    to: contractor.user.email,
    subject: `Your payslip for ${MONTH_NAMES[month]} ${year} — ${currency} ${netAmount.toFixed(2)}${currency !== 'AUD' ? ` (AUD ${netAmountAud.toFixed(2)})` : ''}`,
    html: payslipEmailHtml({
      name: contractor.name,
      month,
      year,
      workingDays,
      leaveDays,
      paidLeaveDays,
      unpaidLeaveDays,
      billableDays,
      dailyRate: dailyRateSnap,
      overtimeHours,
      overtimeAmount,
      otMultiplier: otMultiplierSnap,
      netAmount,
      currency,
      currencySnapRate,
      netAmountAud,
      appUrl,
    }),
  }).catch((err) => console.error(`Failed to send payslip email to ${contractor.user.email}:`, err));

  return { id: payslip.id, netAmount, netAmountAud };
}

/**
 * Regenerate an existing payslip — recalculates all amounts from current
 * leave/overtime data and exchange rates, preserving payment status.
 */
export async function regeneratePayslip(payslipId: string): Promise<{ id: string; netAmount: number; netAmountAud: number } | null> {
  const existing = await prisma.payslip.findUnique({ where: { id: payslipId } });
  if (!existing) return null;

  const { contractorId, periodMonth, periodYear } = existing;

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: {
      user: true,
      leaveRequests: {
        where: { status: 'approved' },
        select: { leaveDate: true, status: true },
      },
      overtimeRequests: {
        where: { status: 'approved' },
        select: { overtimeDate: true, hours: true, status: true },
      },
    },
  });

  if (!contractor) return null;

  const workingDays = getPayslipWorkingDays(periodMonth, periodYear, contractor.startDate);
  const leave = await computePeriodLeaveForContractor(contractorId, periodMonth, periodYear);
  const leaveDays = leave.totalDays;
  const paidLeaveDays = leave.paidDays;
  const unpaidLeaveDays = leave.unpaidDays;
  const billableDays = Math.max(0, workingDays - unpaidLeaveDays);
  const dailyRateSnap = contractor.dailyRate;
  const grossAmount = workingDays * dailyRateSnap;
  const deductions = unpaidLeaveDays * dailyRateSnap;
  const otMultiplierSnap = contractor.otMultiplier ?? 1;
  const overtimeHours = getApprovedOvertimeHours(contractor.overtimeRequests, periodMonth, periodYear);
  const overtimeAmount = overtimeHours * (dailyRateSnap / HOURS_PER_DAY) * otMultiplierSnap;
  const netAmount = (billableDays * dailyRateSnap) + overtimeAmount;
  const currency = contractor.currency ?? 'AUD';
  const currencySnapRate = await getExchangeRate(currency);
  const netAmountAud = netAmount * currencySnapRate;

  const updated = await prisma.payslip.update({
    where: { id: payslipId },
    data: {
      workingDays,
      leaveDays,
      paidLeaveDays,
      unpaidLeaveDays,
      billableDays,
      dailyRateSnap,
      grossAmount,
      deductions,
      overtimeHours,
      overtimeAmount,
      otMultiplierSnap,
      netAmount,
      currency,
      currencySnapRate,
      netAmountAud,
      // paymentStatus / paidAt / paidAmount preserved (not touched)
    },
  });

  return { id: updated.id, netAmount: updated.netAmount, netAmountAud: updated.netAmountAud };
}

/**
 * Generate payslips for ALL active contractors for the current month.
 * Called automatically on admin login on/after the 25th.
 * Completely idempotent.
 */
export async function triggerMonthlyPayslips(): Promise<void> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const activeContractors = await prisma.contractor.findMany({
    where: { isActive: true, user: { isActive: true } },
    select: { id: true },
  });

  console.log(`[PayslipEngine] Triggering payslips for ${activeContractors.length} contractors — ${MONTH_NAMES[month]} ${year}`);

  for (const c of activeContractors) {
    try {
      const result = await generatePayslipForContractor(c.id, month, year);
      if (result) {
        console.log(`[PayslipEngine] Generated payslip ${result.id} — net: ${result.netAmount} (AUD ${result.netAmountAud})`);
      }
    } catch (err) {
      console.error(`[PayslipEngine] Failed for contractor ${c.id}:`, err);
    }
  }
}
