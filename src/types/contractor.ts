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
  createdAt: string;
  updatedAt: string;
  user: ContractorUser;
}

export interface LeaveRequest {
  id: string;
  contractorId: string;
  leaveDate: string;
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
  billableDays: number;
  dailyRateSnap: number;
  grossAmount: number;
  deductions: number;
  netAmount: number;
  paymentStatus: 'pending' | 'paid';
  paidAmount: number | null;
  paidAt: string | null;
  generatedAt: string;
}

export interface ContractorWithDetails extends ContractorRecord {
  leaveRequests: LeaveRequest[];
  payslips: Payslip[];
}
