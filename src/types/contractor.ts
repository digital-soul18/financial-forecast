export interface ContractorUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface ContractorRecord {
  id: string;
  userId: string;
  name: string;
  dailyRate: number;
  currency: string;
  startDate: string;
  isActive: boolean;
  // Leave policy (added 2026-05-07; see src/lib/leave/)
  probationMonths: number;
  country: string;
  accrualUsableDuringProbation: boolean;
  vlAccrualPerMonth: number;
  slAccrualPerMonth: number;
  /** Overtime pay multiplier. 1 = straight time. PH statutory ordinary-day OT is 1.25. */
  otMultiplier: number;
  createdAt: string;
  updatedAt: string;
  user: ContractorUser;
}

export type LeaveTypeLabel =
  | 'VL' | 'SL' | 'MATERNITY' | 'PATERNITY' | 'PUBLIC_HOLIDAY' | 'UNPAID';

export interface LeaveRequest {
  id: string;
  contractorId: string;
  leaveDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  adminNote: string | null;
  // Classification + balance impact (added 2026-05-07)
  leaveType: LeaveTypeLabel | null;
  days: number;
  classificationNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalanceResponse {
  asOf: string;
  completedMonths: number;
  monthsUntilNextAnniversary: number;
  regularisationDate: string;
  nextAnniversaryDate: string;
  isLockedByProbation: boolean;
  vl: { accrued: number; used: number; forfeited: number; available: number };
  sl: { accrued: number; used: number; forfeited: number; available: number };
}

export interface OvertimeRequest {
  id: string;
  contractorId: string;
  overtimeDate: string;
  hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payslip {
  id: string;
  contractorId: string;
  periodMonth: number;
  periodYear: number;
  workingDays: number;
  leaveDays: number;
  /** Leave days covered by balance — do NOT reduce pay. 0 on pre-cutover payslips. */
  paidLeaveDays: number;
  /** Leave days that reduce pay. */
  unpaidLeaveDays: number;
  billableDays: number;
  dailyRateSnap: number;
  grossAmount: number;
  deductions: number;
  overtimeHours: number;
  overtimeAmount: number;
  otMultiplierSnap: number;
  netAmount: number;
  currency: string;
  currencySnapRate: number;
  netAmountAud: number;
  paymentStatus: 'pending' | 'paid';
  paidAmount: number | null;
  paidAt: string | null;
  generatedAt: string;
}

export interface ContractorWithDetails extends ContractorRecord {
  leaveRequests: LeaveRequest[];
  overtimeRequests: OvertimeRequest[];
  payslips: Payslip[];
}
