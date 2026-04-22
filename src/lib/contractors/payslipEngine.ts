import { prisma } from '@/lib/db';
import { getPayslipWorkingDays, getApprovedLeaveDays } from './workingDays';
import { sendEmail } from '@/lib/email/sendEmail';
import { payslipEmailHtml } from '@/lib/email/templates';
import { getAppUrl } from '@/lib/appUrl';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Generate a payslip for a single contractor for a given month/year.
 * Idempotent — returns existing payslip if already generated.
 * Returns null if contractor is inactive or hasn't started yet.
 */
export async function generatePayslipForContractor(
  contractorId: string,
  month: number,
  year: number,
): Promise<{ id: string; netAmount: number } | null> {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: {
      user: true,
      leaveRequests: {
        where: { status: 'approved' },
        select: { leaveDate: true, status: true },
      },
    },
  });

  if (!contractor || !contractor.isActive || !contractor.user.isActive) return null;

  // Check if already exists — return existing (idempotent)
  const existing = await prisma.payslip.findUnique({
    where: {
      contractorId_periodMonth_periodYear: {
        contractorId,
        periodMonth: month,
        periodYear: year,
      },
    },
  });
  if (existing) return { id: existing.id, netAmount: existing.netAmount };

  const workingDays = getPayslipWorkingDays(month, year, contractor.startDate);
  if (workingDays === 0) return null; // Contractor not started yet

  const leaveDays = getApprovedLeaveDays(contractor.leaveRequests, month, year);
  const billableDays = Math.max(0, workingDays - leaveDays);
  const dailyRateSnap = contractor.dailyRate;
  const grossAmount = workingDays * dailyRateSnap;
  const deductions = leaveDays * dailyRateSnap;
  const netAmount = billableDays * dailyRateSnap;

  const payslip = await prisma.payslip.create({
    data: {
      contractorId,
      periodMonth: month,
      periodYear: year,
      workingDays,
      leaveDays,
      billableDays,
      dailyRateSnap,
      grossAmount,
      deductions,
      netAmount,
      paymentStatus: 'pending',
    },
  });

  // Send payslip email asynchronously — don't block
  const appUrl = getAppUrl();
  sendEmail({
    to: contractor.user.email,
    subject: `Your payslip for ${MONTH_NAMES[month]} ${year} — ${contractor.currency} ${netAmount.toFixed(2)}`,
    html: payslipEmailHtml({
      name: contractor.name,
      month,
      year,
      workingDays,
      leaveDays,
      billableDays,
      dailyRate: dailyRateSnap,
      netAmount,
      currency: contractor.currency,
      appUrl,
    }),
  }).catch((err) => console.error(`Failed to send payslip email to ${contractor.user.email}:`, err));

  return { id: payslip.id, netAmount };
}

/**
 * Generate payslips for ALL active contractors for the current month.
 * Called automatically on admin login on/after the 25th of the month.
 * Completely idempotent — safe to call multiple times.
 */
export async function triggerMonthlyPayslips(): Promise<void> {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
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
        console.log(`[PayslipEngine] Generated payslip ${result.id} for contractor ${c.id} — net: ${result.netAmount}`);
      }
    } catch (err) {
      console.error(`[PayslipEngine] Failed for contractor ${c.id}:`, err);
    }
  }
}
