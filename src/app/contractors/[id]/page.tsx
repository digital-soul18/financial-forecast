'use client';

import { useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft, Pencil, Check, X, Plus, Trash2, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, CircleDot, CircleOff, Zap,
} from 'lucide-react';
import type { ContractorWithDetails, LeaveRequest, OvertimeRequest, Payslip } from '@/types/contractor';
import LeaveBalanceCard from '@/components/contractor/LeaveBalanceCard';
import { LeaveTypeEditor } from '@/components/contractor/LeaveTypeEditor';
import { SUPPORTED_CURRENCIES } from '@/lib/contractors/currencies';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400"><CheckCircle2 className="w-3 h-3" />Approved</span>;
  if (status === 'denied') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-950 text-red-400"><XCircle className="w-3 h-3" />Denied</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-400"><AlertCircle className="w-3 h-3" />Pending</span>;
}

export default function ContractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, mutate, isLoading } = useSWR<{ contractor: ContractorWithDetails; error?: string }>(
    `/api/contractors/${id}`,
    fetcher,
  );
  const contractor = data?.contractor;

  // Edit info state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', dailyRate: '', startDate: '', currency: 'AUD',
    probationMonths: '6', country: 'PH', accrualUsableDuringProbation: false,
    otMultiplier: '1',
    payModel: 'daily', monthlySalary: '', probationSalary: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Leave form
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveDate: '', reason: '' });
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  // Overtime form
  const [showOtForm, setShowOtForm] = useState(false);
  const [otForm, setOtForm] = useState({ overtimeDate: '', hours: '', reason: '' });
  const [otLoading, setOtLoading] = useState(false);
  const [otError, setOtError] = useState('');

  // Payslip generation
  const [genLoading, setGenLoading] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  // Payslip regeneration (per-row)
  const [regenLoadingId, setRegenLoadingId] = useState<string | null>(null);
  const [regenMessage, setRegenMessage] = useState<{ id: string; msg: string } | null>(null);

  function startEditing() {
    if (!contractor) return;
    setEditForm({
      name: contractor.name,
      dailyRate: String(contractor.dailyRate),
      startDate: contractor.startDate.split('T')[0],
      currency: contractor.currency ?? 'AUD',
      probationMonths: String(contractor.probationMonths ?? 6),
      country: contractor.country ?? 'PH',
      accrualUsableDuringProbation: Boolean(contractor.accrualUsableDuringProbation),
      otMultiplier: String(contractor.otMultiplier ?? 1),
      payModel: contractor.payModel ?? 'daily',
      monthlySalary: contractor.monthlySalary != null ? String(contractor.monthlySalary) : '',
      probationSalary: contractor.probationSalary != null ? String(contractor.probationSalary) : '',
    });
    setEditing(true);
  }

  async function saveEdit() {
    setEditLoading(true);
    await fetch(`/api/contractors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        dailyRate: Number(editForm.dailyRate),
        startDate: editForm.startDate,
        currency: editForm.currency,
        probationMonths: Number(editForm.probationMonths),
        country: editForm.country,
        accrualUsableDuringProbation: editForm.accrualUsableDuringProbation,
        otMultiplier: Number(editForm.otMultiplier),
        payModel: editForm.payModel,
        monthlySalary: editForm.monthlySalary === '' ? null : Number(editForm.monthlySalary),
        probationSalary: editForm.probationSalary === '' ? null : Number(editForm.probationSalary),
      }),
    });
    setEditing(false);
    setEditLoading(false);
    mutate();
  }

  async function toggleActive() {
    if (!contractor) return;
    await fetch(`/api/contractors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !contractor.isActive }),
    });
    mutate();
  }

  async function handlePaymentToggle(payslip: Payslip) {
    const newStatus = payslip.paymentStatus === 'paid' ? 'pending' : 'paid';
    await fetch(`/api/contractors/${id}/payslips/${payslip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: newStatus }),
    });
    mutate();
  }

  async function handleGeneratePayslip() {
    setGenLoading(true);
    setGenMessage('');
    const now = new Date();
    const res = await fetch('/api/payslips/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear(), contractorId: id }),
    });
    const body = await res.json();
    setGenMessage(body.message ?? (body.generated > 0 ? `Payslip generated` : 'Already generated this month'));
    setGenLoading(false);
    mutate();
  }

  async function handleRegeneratePayslip(payslip: Payslip) {
    setRegenLoadingId(payslip.id);
    setRegenMessage(null);
    try {
      const res = await fetch(`/api/contractors/${id}/payslips/${payslip.id}`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setRegenMessage({ id: payslip.id, msg: body.error ?? 'Failed' });
      } else {
        setRegenMessage({ id: payslip.id, msg: 'Recalculated ✓' });
        mutate();
        setTimeout(() => setRegenMessage(null), 3000);
      }
    } finally {
      setRegenLoadingId(null);
    }
  }

  async function handleLeaveStatusChange(leave: LeaveRequest, status: 'approved' | 'denied') {
    await fetch(`/api/leave/${leave.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    mutate();
  }

  async function handleLeaveDelete(leaveId: string) {
    if (!confirm('Delete this leave request?')) return;
    await fetch(`/api/leave/${leaveId}`, { method: 'DELETE' });
    mutate();
  }

  async function handleAddLeave(e: React.FormEvent) {
    e.preventDefault();
    setLeaveLoading(true);
    setLeaveError('');
    const res = await fetch(`/api/contractors/${id}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leaveForm),
    });
    const body = await res.json();
    if (!res.ok) { setLeaveError(body.error ?? 'Failed to add'); setLeaveLoading(false); return; }
    setShowLeaveForm(false);
    setLeaveForm({ leaveDate: '', reason: '' });
    setLeaveLoading(false);
    mutate();
  }

  async function handleOvertimeStatusChange(ot: OvertimeRequest, status: 'approved' | 'denied') {
    await fetch(`/api/overtime/${ot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    mutate();
  }

  async function handleOvertimeDelete(otId: string) {
    if (!confirm('Delete this overtime request?')) return;
    await fetch(`/api/overtime/${otId}`, { method: 'DELETE' });
    mutate();
  }

  async function handleAddOvertime(e: React.FormEvent) {
    e.preventDefault();
    setOtLoading(true);
    setOtError('');
    const res = await fetch(`/api/contractors/${id}/overtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...otForm, hours: Number(otForm.hours) }),
    });
    const body = await res.json();
    if (!res.ok) { setOtError(body.error ?? 'Failed to add'); setOtLoading(false); return; }
    setShowOtForm(false);
    setOtForm({ overtimeDate: '', hours: '', reason: '' });
    setOtLoading(false);
    mutate();
  }

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  if (data?.error) return <div className="p-6 text-red-400 text-sm">Error: {data.error}</div>;
  if (!contractor) return <div className="p-6 text-gray-400 text-sm">Contractor not found.</div>;

  const payslips: Payslip[] = contractor.payslips ?? [];
  const leaveRequests: LeaveRequest[] = contractor.leaveRequests ?? [];

  // ── Payslip "what-if" simulator ────────────────────────────────────────
  // For each payslip period, count approved-leave days whose new-logic type
  // is paid (VL / SL / public holiday / mat/pat). The simulated net adds
  // those days back to billable. Only the column is shown if there are any
  // paid-leave days across the visible payslip set.
  const PAID_LEAVE_TYPES = new Set(['VL', 'SL', 'PUBLIC_HOLIDAY', 'MATERNITY', 'PATERNITY']);
  function paidLeaveDaysInPeriod(month: number, year: number): number {
    let total = 0;
    for (const lr of leaveRequests) {
      if (lr.status !== 'approved') continue;
      if (!lr.leaveType || !PAID_LEAVE_TYPES.has(lr.leaveType)) continue;
      const d = new Date(lr.leaveDate);
      if (d.getFullYear() === year && d.getMonth() + 1 === month) total += lr.days ?? 1;
    }
    return total;
  }
  /**
   * A payslip predates the 2026-06 cutover if it has leave but no paidLeaveDays
   * recorded — i.e. it was generated when ALL leave reduced pay. Those are the
   * only rows the what-if column is still useful for; it disappears once the
   * row is recalculated under the new logic.
   */
  const isPreCutover = (p: Payslip) =>
    (p.paidLeaveDays ?? 0) === 0 &&
    paidLeaveDaysInPeriod(p.periodMonth, p.periodYear) > 0;
  const showSimulator = payslips.some(isPreCutover);
  const overtimeRequests: OvertimeRequest[] = contractor.overtimeRequests ?? [];
  const currency = contractor.currency ?? 'AUD';
  const showAud = currency !== 'AUD';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <Link href="/contractors" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" />Back to Contractors
      </Link>

      {/* ── Info card ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex flex-wrap items-start gap-3 justify-between mb-4">
          <div>
            <h1 className="text-white text-xl font-semibold">{contractor.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{contractor.user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {contractor.isActive ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400">
                <CircleDot className="w-3 h-3" />Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-500">
                <CircleOff className="w-3 h-3" />Inactive
              </span>
            )}
            {!editing && (
              <button onClick={startEditing} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                <Pencil className="w-3.5 h-3.5" />Edit
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Name</label>
              <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Daily Rate</label>
              <input type="number" value={editForm.dailyRate} onChange={(e) => setEditForm((p) => ({ ...p, dailyRate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Currency</label>
              <select value={editForm.currency} onChange={(e) => setEditForm((p) => ({ ...p, currency: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Start Date</label>
              <input type="date" value={editForm.startDate} onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            {/* ── Pay model ────────────────────────────────────────────────── */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide" title="Monthly = flat contracted salary. Daily = workingDays x dailyRate (pay swings 20-23 days/month).">
                Pay model
              </label>
              <select value={editForm.payModel}
                onChange={(e) => setEditForm((p) => ({ ...p, payModel: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="daily">Daily rate × working days</option>
                <option value="monthly">Fixed monthly salary</option>
              </select>
            </div>
            {editForm.payModel === 'monthly' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Monthly salary</label>
                  <input type="number" step="0.01" min="0" value={editForm.monthlySalary}
                    placeholder="e.g. 5000"
                    onChange={(e) => setEditForm((p) => ({ ...p, monthlySalary: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide" title="Leave blank if the contract has no separate probation rate.">
                    Probation salary <span className="normal-case text-gray-600">(optional)</span>
                  </label>
                  <input type="number" step="0.01" min="0" value={editForm.probationSalary}
                    placeholder="blank = same"
                    onChange={(e) => setEditForm((p) => ({ ...p, probationSalary: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </>
            )}
            {/* ── Leave policy (drives src/lib/leave/ engine) ─────────────────── */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Country</label>
              <select value={editForm.country} onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="PH">PH (Philippines)</option>
                <option value="IN">IN (India)</option>
                <option value="AU">AU (Australia)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide" title="Months from start date until regularisation. PH=6, IN=3 by contract default.">
                Probation (months)
              </label>
              <input type="number" min="0" max="24" value={editForm.probationMonths}
                onChange={(e) => setEditForm((p) => ({ ...p, probationMonths: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide" title="Multiplier applied to the hourly OT rate. 1.0 = straight time.">
                OT multiplier
              </label>
              <select value={editForm.otMultiplier}
                onChange={(e) => setEditForm((p) => ({ ...p, otMultiplier: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="1">1.00× — straight time</option>
                <option value="1.25">1.25× — PH ordinary-day OT</option>
                <option value="1.3">1.30× — rest-day / special holiday</option>
                <option value="1.5">1.50× — time-and-a-half</option>
                <option value="2">2.00× — double time</option>
              </select>
              <p className="text-[10px] text-gray-600 mt-1">
                Applies to payslips generated or recalculated after saving.
              </p>
            </div>
            <div className="col-span-full flex items-center gap-2 -mt-1">
              <input type="checkbox" id="accrualUsable" checked={editForm.accrualUsableDuringProbation}
                onChange={(e) => setEditForm((p) => ({ ...p, accrualUsableDuringProbation: e.target.checked }))}
                className="w-4 h-4 accent-violet-500" />
              <label htmlFor="accrualUsable" className="text-xs text-gray-300">
                Accrued VL/SL is usable during probation
                <span className="text-gray-500 ml-2">(PH contract: off · IN contract: on)</span>
              </label>
            </div>
            <div className="col-span-full flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                <X className="w-3.5 h-3.5" />Cancel
              </button>
              <button onClick={saveEdit} disabled={editLoading} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                <Check className="w-3.5 h-3.5" />{editLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Daily Rate</p>
              <p className="text-violet-300 font-semibold">{currency} {fmt(contractor.dailyRate)}</p>
              {showAud && <p className="text-gray-500 text-xs mt-0.5">Paid in {currency}</p>}
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Start Date</p>
              <p className="text-white">{format(new Date(contractor.startDate), 'd MMM yyyy')}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Est. Monthly</p>
              <p className="text-white">{currency} {fmt(contractor.dailyRate * 22)}</p>
            </div>
            <div className="flex items-end">
              <button
                onClick={toggleActive}
                className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors"
              >
                {contractor.isActive ? 'Disable Account' : 'Enable Account'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Payslips ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-medium text-sm">Payslips</h2>
          <div className="flex items-center gap-2">
            {genMessage && <span className="text-xs text-gray-400">{genMessage}</span>}
            <button onClick={handleGeneratePayslip} disabled={genLoading}
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${genLoading ? 'animate-spin' : ''}`} />
              Generate This Month
            </button>
          </div>
        </div>
        {payslips.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No payslips generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Period</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Days</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Leave</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">OT hrs</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Net ({currency})</th>
                {showSimulator && (
                  <th
                    className="text-right px-4 py-3 text-xs text-amber-300 font-medium uppercase tracking-wide"
                    title="What net pay WOULD be if VL/SL/public-holiday days didn't deduct. Does not change actual pay — for validation only."
                  >
                    What-if ({currency})
                  </th>
                )}
                {showAud && <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Net (AUD)</th>}
                <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Payment</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payslips.map((p) => (
                <tr key={p.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-white font-medium">{MONTH_NAMES[p.periodMonth]} {p.periodYear}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-300 text-right">{p.billableDays}/{p.workingDays}</td>
                  <td className="px-4 py-3.5 text-sm text-right">
                    {p.leaveDays > 0 ? (
                      <span
                        title={
                          isPreCutover(p)
                            ? `${p.leaveDays}d leave — all deducted from pay (pre-cutover payslip)`
                            : `${p.paidLeaveDays ?? 0}d paid (from balance) · ${p.unpaidLeaveDays ?? 0}d unpaid`
                        }
                      >
                        <span className={(p.unpaidLeaveDays ?? p.leaveDays) > 0 ? 'text-red-400' : 'text-emerald-400'}>
                          {p.leaveDays}d
                        </span>
                        {!isPreCutover(p) && (p.paidLeaveDays ?? 0) > 0 && (
                          <span className="block text-[10px] text-emerald-500">{p.paidLeaveDays}d paid</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-500">0d</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-right">
                    <span className={(p.overtimeHours ?? 0) > 0 ? 'text-emerald-400' : 'text-gray-600'}>
                      {(p.overtimeHours ?? 0) > 0 ? `${p.overtimeHours}h` : '—'}
                    </span>
                    {(p.otMultiplierSnap ?? 1) !== 1 && (p.overtimeHours ?? 0) > 0 && (
                      <span className="block text-[10px] text-amber-400" title={`Overtime paid at ${p.otMultiplierSnap}× the hourly rate`}>
                        @ {p.otMultiplierSnap}×
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-violet-300 font-semibold text-right">{currency} {fmt(p.netAmount)}</td>
                  {showSimulator && (() => {
                    if (!isPreCutover(p)) {
                      return (
                        <td className="px-4 py-3.5 text-sm text-right" title="This payslip already uses the current logic — paid leave does not reduce pay.">
                          <span className="text-[10px] text-emerald-500">✓ applied</span>
                        </td>
                      );
                    }
                    // Pre-cutover row: show what it WOULD pay under current rules.
                    // Cap the add-back at what was actually deducted.
                    const paidDaysRaw = paidLeaveDaysInPeriod(p.periodMonth, p.periodYear);
                    const paidDays = Math.min(paidDaysRaw, p.leaveDays);
                    const addBack  = paidDays * p.dailyRateSnap;
                    const simNet   = p.netAmount + addBack;
                    const otRate   = (p.dailyRateSnap / 8) * (p.otMultiplierSnap ?? 1);
                    const tooltip  = [
                      `Working days: ${p.workingDays} × ${currency} ${fmt(p.dailyRateSnap)} = ${currency} ${fmt(p.workingDays * p.dailyRateSnap)}`,
                      `Overtime: ${p.overtimeHours ?? 0}h × ${currency} ${fmt(otRate)} = ${currency} ${fmt(p.overtimeAmount ?? 0)}`,
                      `Paid leave add-back: ${paidDays} × ${currency} ${fmt(p.dailyRateSnap)} = ${currency} ${fmt(addBack)}`,
                      `─────────────────────`,
                      `Current net: ${currency} ${fmt(p.netAmount)} (old logic — all leave deducted)`,
                      `After Recalc: ${currency} ${fmt(simNet)}`,
                      ``,
                      `Click Recalc to apply.`,
                    ].join('\n');
                    return (
                      <td className="px-4 py-3.5 text-sm text-right" title={tooltip}>
                        <span className="text-amber-300 font-semibold">{currency} {fmt(simNet)}</span>
                        <span className="block text-[10px] text-emerald-400">+{currency} {fmt(addBack)}</span>
                      </td>
                    );
                  })()}
                  {showAud && (
                    <td className="px-4 py-3.5 text-sm text-gray-400 text-right">
                      AUD {fmt(p.netAmountAud ?? p.netAmount)}
                      {p.currencySnapRate && p.currencySnapRate !== 1 && (
                        <span className="block text-[10px] text-gray-600">rate: {p.currencySnapRate.toFixed(4)}</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3.5 text-center">
                    {p.paymentStatus === 'paid'
                      ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400">Paid</span>
                      : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-400">Unpaid</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      {regenMessage?.id === p.id && (
                        <span className="text-xs text-emerald-400">{regenMessage.msg}</span>
                      )}
                      <button
                        onClick={() => handleRegeneratePayslip(p)}
                        disabled={regenLoadingId === p.id}
                        title="Recalculate payslip amounts"
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3 h-3 ${regenLoadingId === p.id ? 'animate-spin' : ''}`} />
                        Recalc
                      </button>
                      <button onClick={() => handlePaymentToggle(p)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors">
                        {p.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* ── Leave balance ── */}
      <LeaveBalanceCard contractorId={contractor.id} />

      {/* ── Leave Requests ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-medium text-sm">Leave Requests</h2>
          <button onClick={() => { setShowLeaveForm(true); setLeaveError(''); }}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors">
            <Plus className="w-3 h-3" />Add Leave
          </button>
        </div>

        {showLeaveForm && (
          <form onSubmit={handleAddLeave} className="px-5 py-4 border-b border-gray-800 bg-gray-800/50">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Date</label>
                <input type="date" value={leaveForm.leaveDate} required
                  onChange={(e) => setLeaveForm((p) => ({ ...p, leaveDate: e.target.value }))}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Reason</label>
                <input type="text" value={leaveForm.reason} required placeholder="e.g. Annual leave"
                  onChange={(e) => setLeaveForm((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <button type="submit" disabled={leaveLoading}
                className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                {leaveLoading ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={() => setShowLeaveForm(false)}
                className="text-gray-400 hover:text-white px-2 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {leaveError && <p className="text-red-400 text-xs mt-2">{leaveError}</p>}
          </form>
        )}

        {leaveRequests.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <p className="text-gray-500 text-sm">No leave requests yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Reason</th>
                <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Admin Note</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map((lr) => (
                <tr key={lr.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-white font-medium">{format(new Date(lr.leaveDate), 'EEE, d MMM yyyy')}</td>
                  <td className="px-4 py-3.5">
                    <LeaveTypeEditor
                      leaveId={lr.id}
                      currentType={lr.leaveType}
                      days={lr.days}
                      onChanged={() => mutate()}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-300">{lr.reason}</td>
                  <td className="px-4 py-3.5 text-center"><StatusBadge status={lr.status} /></td>
                  <td className="px-4 py-3.5 text-sm text-gray-500 italic">{lr.adminNote ?? '—'}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      {lr.status !== 'approved' && (
                        <button onClick={() => handleLeaveStatusChange(lr, 'approved')}
                          className="p-1.5 text-emerald-400 hover:bg-emerald-950 rounded transition-colors" title="Approve">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {lr.status !== 'denied' && (
                        <button onClick={() => handleLeaveStatusChange(lr, 'denied')}
                          className="p-1.5 text-red-400 hover:bg-red-950 rounded transition-colors" title="Deny">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleLeaveDelete(lr.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950 rounded transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* ── Overtime Requests ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h2 className="text-white font-medium text-sm">Overtime Requests</h2>
          </div>
          <button onClick={() => { setShowOtForm(true); setOtError(''); }}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors">
            <Plus className="w-3 h-3" />Add Overtime
          </button>
        </div>

        {showOtForm && (
          <form onSubmit={handleAddOvertime} className="px-5 py-4 border-b border-gray-800 bg-gray-800/50">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Date</label>
                <input type="date" value={otForm.overtimeDate} required
                  onChange={(e) => setOtForm((p) => ({ ...p, overtimeDate: e.target.value }))}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Hours</label>
                <input type="number" value={otForm.hours} required min="0.5" max="24" step="0.5" placeholder="e.g. 2"
                  onChange={(e) => setOtForm((p) => ({ ...p, hours: e.target.value }))}
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Reason</label>
                <input type="text" value={otForm.reason} required placeholder="e.g. Sprint release"
                  onChange={(e) => setOtForm((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <button type="submit" disabled={otLoading}
                className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
                {otLoading ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={() => setShowOtForm(false)}
                className="text-gray-400 hover:text-white px-2 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {otError && <p className="text-red-400 text-xs mt-2">{otError}</p>}
          </form>
        )}

        {overtimeRequests.length === 0 ? (
          <div className="py-12 text-center space-y-1">
            <p className="text-gray-500 text-sm">No overtime requests.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[540px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Hours</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Reason</th>
                <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Note</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {overtimeRequests.map((ot) => (
                <tr key={ot.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-white font-medium">{format(new Date(ot.overtimeDate), 'EEE, d MMM yyyy')}</td>
                  <td className="px-4 py-3.5 text-sm text-emerald-400 font-medium text-right">{ot.hours}h</td>
                  <td className="px-4 py-3.5 text-sm text-gray-300">{ot.reason}</td>
                  <td className="px-4 py-3.5 text-center"><StatusBadge status={ot.status} /></td>
                  <td className="px-4 py-3.5 text-sm text-gray-500 italic">{ot.adminNote ?? '—'}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      {ot.status !== 'approved' && (
                        <button onClick={() => handleOvertimeStatusChange(ot, 'approved')}
                          className="p-1.5 text-emerald-400 hover:bg-emerald-950 rounded transition-colors" title="Approve">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      {ot.status !== 'denied' && (
                        <button onClick={() => handleOvertimeStatusChange(ot, 'denied')}
                          className="p-1.5 text-red-400 hover:bg-red-950 rounded transition-colors" title="Deny">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleOvertimeDelete(ot.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-950 rounded transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
