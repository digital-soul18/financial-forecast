'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { format } from 'date-fns';
import { LogOut, Calendar, FileText, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { ContractorWithDetails, LeaveRequest, Payslip } from '@/types/contractor';

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

  const [tab, setTab] = useState<'payslips' | 'leave'>('payslips');
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  async function handleSubmitLeave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveDate, reason: leaveReason }),
      });
      const body = await res.json();
      if (!res.ok) { setSubmitError(body.error ?? 'Failed to submit'); return; }
      setSubmitSuccess('Leave request submitted. Your manager has been notified.');
      setLeaveDate('');
      setLeaveReason('');
      setShowLeaveForm(false);
      mutate('/api/contractor/me');
    } finally {
      setSubmitLoading(false);
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
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-red-400 text-sm">Unable to load your profile. Please try logging in again.</div>
      </div>
    );
  }

  const payslips: Payslip[] = contractor.payslips ?? [];
  const leaveRequests: LeaveRequest[] = contractor.leaveRequests ?? [];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-base">{contractor.name}</p>
            <p className="text-gray-400 text-xs">{contractor.user.email} · Voice AI Solutions Contractor</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Daily Rate</p>
            <p className="text-white font-semibold text-lg">{contractor.currency} {fmt(contractor.dailyRate)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Payslips</p>
            <p className="text-white font-semibold text-lg">{payslips.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Leave Days</p>
            <p className="text-white font-semibold text-lg">{leaveRequests.filter((l) => l.status === 'approved').length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800">
          <button
            onClick={() => setTab('payslips')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'payslips' ? 'border-violet-500 text-violet-400' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            <FileText className="w-4 h-4" />
            Payslips
          </button>
          <button
            onClick={() => setTab('leave')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'leave' ? 'border-violet-500 text-violet-400' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            <Calendar className="w-4 h-4" />
            Leave Requests
            {leaveRequests.filter((l) => l.status === 'pending').length > 0 && (
              <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {leaveRequests.filter((l) => l.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* Payslips tab */}
        {tab === 'payslips' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {payslips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-gray-400 text-sm">No payslips yet</p>
                <p className="text-gray-600 text-xs mt-1">Payslips are generated on the 25th of each month.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Period</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Working Days</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Leave Days</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Billable Days</th>
                    <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Net Amount</th>
                    <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                      <td className="px-5 py-3.5 text-sm text-white font-medium">{MONTH_NAMES[p.periodMonth]} {p.periodYear}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-300 text-right">{p.workingDays}</td>
                      <td className="px-4 py-3.5 text-sm text-right">
                        <span className={p.leaveDays > 0 ? 'text-red-400' : 'text-gray-500'}>{p.leaveDays}</span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-300 text-right">{p.billableDays}</td>
                      <td className="px-4 py-3.5 text-sm text-violet-300 font-semibold text-right">{contractor.currency} {fmt(p.netAmount)}</td>
                      <td className="px-4 py-3.5 text-center"><PaymentBadge status={p.paymentStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Leave tab */}
        {tab === 'leave' && (
          <div className="space-y-4">
            {submitSuccess && (
              <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />{submitSuccess}
              </div>
            )}

            {/* Request leave button */}
            {!showLeaveForm && (
              <div className="flex justify-end">
                <button
                  onClick={() => { setShowLeaveForm(true); setSubmitSuccess(''); }}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  Request Leave
                </button>
              </div>
            )}

            {/* Leave request form */}
            {showLeaveForm && (
              <form onSubmit={handleSubmitLeave} className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
                <h3 className="text-white font-medium text-sm">New Leave Request</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Date</label>
                    <input
                      type="date"
                      value={leaveDate}
                      onChange={(e) => setLeaveDate(e.target.value)}
                      required
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Reason</label>
                    <input
                      type="text"
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      required
                      placeholder="e.g. Annual leave"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
                {submitError && <p className="text-red-400 text-sm">{submitError}</p>}
                <div className="flex items-center gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowLeaveForm(false); setSubmitError(''); }}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {submitLoading ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}

            {/* Leave history */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {leaveRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Calendar className="w-10 h-10 text-gray-700 mb-3" />
                  <p className="text-gray-400 text-sm">No leave requests yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                        <td className="px-5 py-3.5 text-sm text-white font-medium">
                          {format(new Date(lr.leaveDate), 'EEE, d MMM yyyy')}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-300">{lr.reason}</td>
                        <td className="px-4 py-3.5 text-center"><StatusBadge status={lr.status} /></td>
                        <td className="px-4 py-3.5 text-sm text-gray-500 italic">{lr.adminNote ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
