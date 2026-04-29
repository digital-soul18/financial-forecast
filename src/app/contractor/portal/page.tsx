'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { format } from 'date-fns';
import {
  LogOut, Calendar, FileText, Clock, CheckCircle2, XCircle, AlertCircle, Zap,
} from 'lucide-react';
import type { ContractorWithDetails, LeaveRequest, OvertimeRequest, Payslip } from '@/types/contractor';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400"><CheckCircle2 className="w-3 h-3" />Approved</span>;
  if (status === 'denied') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-950 text-red-400"><XCircle className="w-3 h-3" />Denied</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-400"><AlertCircle className="w-3 h-3" />Pending</span>;
}

function PaymentBadge({ status }: { status: string }) {
  if (status === 'paid') return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400">Paid</span>;
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400">Pending</span>;
}

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ContractorPortal() {
  const { data, isLoading } = useSWR<{ contractor: ContractorWithDetails }>('/api/contractor/me', fetcher);
  const contractor = data?.contractor;

  const [tab, setTab] = useState<'payslips' | 'leave' | 'overtime'>('payslips');

  // Leave form state
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');

  // Overtime form state
  const [showOtForm, setShowOtForm] = useState(false);
  const [otDate, setOtDate] = useState('');
  const [otHours, setOtHours] = useState('');
  const [otReason, setOtReason] = useState('');
  const [otLoading, setOtLoading] = useState(false);
  const [otError, setOtError] = useState('');
  const [otSuccess, setOtSuccess] = useState('');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function handleSubmitLeave(e: React.FormEvent) {
    e.preventDefault();
    setLeaveLoading(true);
    setLeaveError('');
    setLeaveSuccess('');
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveDate, reason: leaveReason }),
      });
      const body = await res.json();
      if (!res.ok) { setLeaveError(body.error ?? 'Failed to submit'); return; }
      setLeaveSuccess('Leave request submitted. Your manager has been notified.');
      setLeaveDate('');
      setLeaveReason('');
      setShowLeaveForm(false);
      mutate('/api/contractor/me');
    } finally {
      setLeaveLoading(false);
    }
  }

  async function handleSubmitOvertime(e: React.FormEvent) {
    e.preventDefault();
    setOtLoading(true);
    setOtError('');
    setOtSuccess('');
    try {
      const res = await fetch('/api/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overtimeDate: otDate, hours: Number(otHours), reason: otReason }),
      });
      const body = await res.json();
      if (!res.ok) { setOtError(body.error ?? 'Failed to submit'); return; }
      setOtSuccess('Overtime request submitted. Your manager has been notified.');
      setOtDate('');
      setOtHours('');
      setOtReason('');
      setShowOtForm(false);
      mutate('/api/contractor/me');
    } finally {
      setOtLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!contractor) {
    const apiError = (data as { error?: string } | undefined)?.error;
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-red-400 text-sm">Unable to load your profile.</div>
          {apiError && <div className="text-gray-500 text-xs font-mono bg-gray-900 px-3 py-1.5 rounded">{apiError}</div>}
          <button
            onClick={handleLogout}
            className="block mx-auto mt-3 text-violet-400 hover:text-violet-300 text-sm transition-colors"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  const payslips: Payslip[] = contractor.payslips ?? [];
  const leaveRequests: LeaveRequest[] = contractor.leaveRequests ?? [];
  const overtimeRequests: OvertimeRequest[] = contractor.overtimeRequests ?? [];
  const showAud = contractor.currency !== 'AUD';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm sm:text-base truncate">{contractor.name}</p>
            <p className="text-gray-400 text-xs truncate">{contractor.user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors px-2 sm:px-3 py-1.5 rounded-lg hover:bg-gray-800 shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6">

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Monthly Rate</p>
            <p className="text-white font-semibold text-base sm:text-lg">{contractor.currency} {fmt(contractor.dailyRate * 22)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Payslips</p>
            <p className="text-white font-semibold text-base sm:text-lg">{payslips.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Leave Days</p>
            <p className="text-white font-semibold text-base sm:text-lg">{leaveRequests.filter((l) => l.status === 'approved').length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">OT Approved</p>
            <p className="text-white font-semibold text-base sm:text-lg">
              {overtimeRequests.filter((o) => o.status === 'approved').reduce((s, o) => s + o.hours, 0)}h
            </p>
          </div>
        </div>

        {/* Tabs — horizontally scrollable on mobile */}
        <div className="-mx-4 sm:mx-0">
          <div className="flex overflow-x-auto border-b border-gray-800 px-4 sm:px-0 scrollbar-hide">
            {([
              { key: 'payslips', label: 'Payslips', icon: FileText, badge: 0 },
              { key: 'leave',    label: 'Leave',    icon: Calendar,
                badge: leaveRequests.filter((l) => l.status === 'pending').length },
              { key: 'overtime', label: 'Overtime', icon: Zap,
                badge: overtimeRequests.filter((o) => o.status === 'pending').length },
            ] as const).map(({ key, label, icon: Icon, badge }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap shrink-0 transition-colors ${
                  tab === key ? 'border-violet-500 text-violet-400' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge > 0 && (
                  <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Payslips tab ── */}
        {tab === 'payslips' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {payslips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-gray-400 text-sm">No payslips yet</p>
                <p className="text-gray-600 text-xs mt-1">Payslips are generated on the 25th of each month.</p>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-gray-800">
                  {payslips.map((p) => (
                    <div key={p.id} className="px-4 py-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-medium text-sm">{MONTH_NAMES[p.periodMonth]} {p.periodYear}</p>
                        <PaymentBadge status={p.paymentStatus} />
                      </div>
                      <p className="text-violet-300 font-semibold text-lg">{contractor.currency} {fmt(p.netAmount)}</p>
                      {showAud && <p className="text-gray-400 text-xs">≈ AUD {fmt(p.netAmountAud ?? p.netAmount)}</p>}
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{p.billableDays}/{p.workingDays} days</span>
                        {p.leaveDays > 0 && <span className="text-red-400">{p.leaveDays}d leave</span>}
                        {(p.overtimeHours ?? 0) > 0 && <span className="text-emerald-400">{p.overtimeHours}h OT</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Period</th>
                        <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Days</th>
                        <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">OT hrs</th>
                        <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Net ({contractor.currency})</th>
                        {showAud && <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Net (AUD)</th>}
                        <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslips.map((p) => (
                        <tr key={p.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                          <td className="px-5 py-3.5 text-sm text-white font-medium">{MONTH_NAMES[p.periodMonth]} {p.periodYear}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-300 text-right">{p.billableDays}/{p.workingDays}</td>
                          <td className="px-4 py-3.5 text-sm text-right">
                            <span className={(p.overtimeHours ?? 0) > 0 ? 'text-emerald-400' : 'text-gray-600'}>
                              {(p.overtimeHours ?? 0) > 0 ? `${p.overtimeHours}h` : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-violet-300 font-semibold text-right">
                            {contractor.currency} {fmt(p.netAmount)}
                          </td>
                          {showAud && (
                            <td className="px-4 py-3.5 text-sm text-gray-400 text-right">
                              AUD {fmt(p.netAmountAud ?? p.netAmount)}
                            </td>
                          )}
                          <td className="px-4 py-3.5 text-center"><PaymentBadge status={p.paymentStatus} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Leave tab ── */}
        {tab === 'leave' && (
          <div className="space-y-4">
            {leaveSuccess && (
              <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />{leaveSuccess}
              </div>
            )}
            {!showLeaveForm && (
              <div className="flex justify-end">
                <button
                  onClick={() => { setShowLeaveForm(true); setLeaveSuccess(''); }}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Clock className="w-4 h-4" />Request Leave
                </button>
              </div>
            )}
            {showLeaveForm && (
              <form onSubmit={handleSubmitLeave} className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-5 space-y-4">
                <h3 className="text-white font-medium text-sm">New Leave Request</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Date</label>
                    <input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} required
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Reason</label>
                    <input type="text" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} required
                      placeholder="e.g. Annual leave"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                </div>
                {leaveError && <p className="text-red-400 text-sm">{leaveError}</p>}
                <div className="flex items-center gap-3 justify-end">
                  <button type="button" onClick={() => { setShowLeaveForm(false); setLeaveError(''); }}
                    className="text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                  <button type="submit" disabled={leaveLoading}
                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                    {leaveLoading ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {leaveRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Calendar className="w-10 h-10 text-gray-700 mb-3" />
                  <p className="text-gray-400 text-sm">No leave requests yet</p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-gray-800">
                    {leaveRequests.map((lr) => (
                      <div key={lr.id} className="px-4 py-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white text-sm font-medium">{format(new Date(lr.leaveDate), 'EEE, d MMM yyyy')}</p>
                          <StatusBadge status={lr.status} />
                        </div>
                        <p className="text-gray-300 text-sm">{lr.reason}</p>
                        {lr.adminNote && <p className="text-gray-500 text-xs italic">{lr.adminNote}</p>}
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[440px]">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Date</th>
                          <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Reason</th>
                          <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Status</th>
                          <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveRequests.map((lr) => (
                          <tr key={lr.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                            <td className="px-5 py-3.5 text-sm text-white font-medium">{format(new Date(lr.leaveDate), 'EEE, d MMM yyyy')}</td>
                            <td className="px-4 py-3.5 text-sm text-gray-300">{lr.reason}</td>
                            <td className="px-4 py-3.5 text-center"><StatusBadge status={lr.status} /></td>
                            <td className="px-4 py-3.5 text-sm text-gray-500 italic">{lr.adminNote ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Overtime tab ── */}
        {tab === 'overtime' && (
          <div className="space-y-4">
            {otSuccess && (
              <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />{otSuccess}
              </div>
            )}
            {!showOtForm && (
              <div className="flex justify-end">
                <button
                  onClick={() => { setShowOtForm(true); setOtSuccess(''); }}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Zap className="w-4 h-4" />Request Overtime
                </button>
              </div>
            )}
            {showOtForm && (
              <form onSubmit={handleSubmitOvertime} className="bg-gray-900 border border-gray-700 rounded-xl p-4 sm:p-5 space-y-4">
                <h3 className="text-white font-medium text-sm">New Overtime Request</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Date</label>
                    <input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} required
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Hours</label>
                    <input type="number" value={otHours} onChange={(e) => setOtHours(e.target.value)} required
                      min="0.5" max="24" step="0.5" placeholder="e.g. 2.5"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Reason</label>
                    <input type="text" value={otReason} onChange={(e) => setOtReason(e.target.value)} required
                      placeholder="e.g. Project deadline"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Overtime is paid at your hourly rate ({contractor.currency} {fmt(contractor.dailyRate / 8)}/h) and added to your next payslip when approved.
                </p>
                {otError && <p className="text-red-400 text-sm">{otError}</p>}
                <div className="flex items-center gap-3 justify-end">
                  <button type="button" onClick={() => { setShowOtForm(false); setOtError(''); }}
                    className="text-gray-400 hover:text-white text-sm transition-colors">Cancel</button>
                  <button type="submit" disabled={otLoading}
                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                    {otLoading ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {overtimeRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Zap className="w-10 h-10 text-gray-700 mb-3" />
                  <p className="text-gray-400 text-sm">No overtime requests yet</p>
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="sm:hidden divide-y divide-gray-800">
                    {overtimeRequests.map((ot) => (
                      <div key={ot.id} className="px-4 py-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white text-sm font-medium">{format(new Date(ot.overtimeDate), 'EEE, d MMM yyyy')}</p>
                          <StatusBadge status={ot.status} />
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-emerald-400 font-medium">{ot.hours}h</span>
                          <span className="text-gray-300">{ot.reason}</span>
                        </div>
                        {ot.adminNote && <p className="text-gray-500 text-xs italic">{ot.adminNote}</p>}
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[480px]">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Date</th>
                          <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Hours</th>
                          <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Reason</th>
                          <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Status</th>
                          <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Note</th>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
