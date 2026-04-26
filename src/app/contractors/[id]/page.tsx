'use client';

import { useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft, Pencil, Check, X, Plus, Trash2, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, CircleDot, CircleOff,
} from 'lucide-react';
import type { ContractorWithDetails, LeaveRequest, Payslip } from '@/types/contractor';

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
  const [editForm, setEditForm] = useState({ name: '', dailyRate: '', startDate: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Add leave form
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveDate: '', reason: '' });
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  // Payslip generation
  const [genLoading, setGenLoading] = useState(false);
  const [genMessage, setGenMessage] = useState('');

  function startEditing() {
    if (!contractor) return;
    setEditForm({
      name: contractor.name,
      dailyRate: String(contractor.dailyRate),
      startDate: contractor.startDate.split('T')[0],
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
    setGenMessage(body.message ?? (body.generated > 0 ? `Payslip generated — AUD ${fmt(body.netAmount)}` : 'Already generated this month'));
    setGenLoading(false);
    mutate();
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

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading…</div>;
  if (data?.error) return <div className="p-6 text-red-400 text-sm">Error: {data.error}</div>;
  if (!contractor) return <div className="p-6 text-gray-400 text-sm">Contractor not found.</div>;

  const payslips: Payslip[] = contractor.payslips ?? [];
  const leaveRequests: LeaveRequest[] = contractor.leaveRequests ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      {/* Back link */}
      <Link href="/contractors" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" />Back to Contractors
      </Link>

      {/* Contractor info card */}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Name</label>
              <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Daily Rate (AUD)</label>
              <input type="number" value={editForm.dailyRate} onChange={(e) => setEditForm((p) => ({ ...p, dailyRate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Start Date</label>
              <input type="date" value={editForm.startDate} onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="col-span-3 flex gap-2 justify-end">
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
              <p className="text-violet-300 font-semibold">AUD {fmt(contractor.dailyRate)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Start Date</p>
              <p className="text-white">{format(new Date(contractor.startDate), 'd MMM yyyy')}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Est. Monthly</p>
              <p className="text-white">AUD {fmt(contractor.dailyRate * 22)}</p>
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

      {/* Payslips card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-medium text-sm">Payslips</h2>
          <div className="flex items-center gap-2">
            {genMessage && <span className="text-xs text-gray-400">{genMessage}</span>}
            <button
              onClick={handleGeneratePayslip}
              disabled={genLoading}
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${genLoading ? 'animate-spin' : ''}`} />
              Generate This Month
            </button>
          </div>
        </div>
        {payslips.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No payslips generated yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Period</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Working Days</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Leave</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Rate</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Net Amount</th>
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
                    <span className={p.leaveDays > 0 ? 'text-red-400' : 'text-gray-500'}>{p.leaveDays}d</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-400 text-right">AUD {fmt(p.dailyRateSnap)}/day</td>
                  <td className="px-4 py-3.5 text-sm text-violet-300 font-semibold text-right">AUD {fmt(p.netAmount)}</td>
                  <td className="px-4 py-3.5 text-center">
                    {p.paymentStatus === 'paid' ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400">Paid</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-400">Unpaid</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handlePaymentToggle(p)}
                      className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                    >
                      {p.paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Leave requests card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-medium text-sm">Leave Requests</h2>
          <button
            onClick={() => { setShowLeaveForm(true); setLeaveError(''); }}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 px-3 py-1.5 rounded-lg hover:bg-gray-800 border border-gray-700 transition-colors"
          >
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
            <p className="text-gray-600 text-xs">The contractor can request leave from their portal, or use "Add Leave" above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Reason</th>
                <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Admin Note</th>
                <th className="px-4 py-3" />
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
    </div>
  );
}
