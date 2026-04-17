'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { format } from 'date-fns';
import { UserPlus, Users, ChevronRight, CircleDot, CircleOff } from 'lucide-react';
import type { ContractorRecord } from '@/types/contractor';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ContractorsPage() {
  const [showInactive, setShowInactive] = useState(false);
  const { data, mutate } = useSWR<{ contractors: ContractorRecord[] }>(
    `/api/contractors?includeInactive=${showInactive}`,
    fetcher,
  );
  const contractors = data?.contractors ?? [];

  // Add contractor form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', dailyRate: '', startDate: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const activeContractors = contractors.filter((c) => c.isActive);
  const pendingPayslips = 0; // Placeholder — would need a separate API call

  function handleChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleAddContractor(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      const res = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          dailyRate: Number(form.dailyRate),
          startDate: form.startDate,
        }),
      });
      const body = await res.json();
      if (!res.ok) { setFormError(body.error ?? 'Failed to add contractor'); return; }
      setFormSuccess(`${form.name} has been added and sent an invite email.`);
      setForm({ name: '', email: '', dailyRate: '', startDate: '' });
      setShowForm(false);
      mutate();
    } finally {
      setFormLoading(false);
    }
  }

  async function handleToggleActive(contractor: ContractorRecord) {
    const newStatus = !contractor.isActive;
    await fetch(`/api/contractors/${contractor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: newStatus }),
    });
    mutate();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Contractors</h1>
          <p className="text-gray-400 text-sm mt-0.5">{activeContractors.length} active</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-violet-600 focus:ring-violet-500"
            />
            Show inactive
          </label>
          <button
            onClick={() => { setShowForm(true); setFormSuccess(''); setFormError(''); }}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Contractor
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Active Contractors</p>
          <p className="text-white text-2xl font-bold">{activeContractors.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total Daily Cost</p>
          <p className="text-white text-2xl font-bold">
            AUD {fmt(activeContractors.reduce((s, c) => s + c.dailyRate, 0))}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Est. Monthly Cost</p>
          <p className="text-white text-2xl font-bold">
            AUD {fmt(activeContractors.reduce((s, c) => s + c.dailyRate * 22, 0))}
          </p>
          <p className="text-gray-600 text-xs mt-1">~22 working days</p>
        </div>
      </div>

      {/* Success message */}
      {formSuccess && (
        <div className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-sm px-4 py-3 rounded-xl">
          ✓ {formSuccess}
        </div>
      )}

      {/* Add contractor form */}
      {showForm && (
        <div className="bg-gray-900 border border-violet-800 rounded-xl p-6">
          <h2 className="text-white font-medium text-sm mb-4">New Contractor</h2>
          <form onSubmit={handleAddContractor}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={handleChange('name')}
                  required
                  placeholder="Joel Sarmiento"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  required
                  placeholder="joel@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Daily Rate (AUD)</label>
                <input
                  type="number"
                  value={form.dailyRate}
                  onChange={handleChange('dailyRate')}
                  required
                  min="0"
                  step="0.01"
                  placeholder="500.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={handleChange('startDate')}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            {formError && <p className="text-red-400 text-sm mb-4">{formError}</p>}
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(''); }}
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {formLoading ? 'Adding…' : 'Add & Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contractors table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {contractors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-gray-400 text-sm">No contractors yet</p>
            <p className="text-gray-600 text-xs mt-1">Add your first contractor to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Email</th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Daily Rate</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Start Date</th>
                <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contractors.map((c) => (
                <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-white text-sm font-medium">{c.name}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-400">{c.user.email}</td>
                  <td className="px-4 py-3.5 text-sm text-violet-300 font-medium text-right">
                    AUD {fmt(c.dailyRate)}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-400">
                    {format(new Date(c.startDate), 'd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {c.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400">
                        <CircleDot className="w-3 h-3" />Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-500">
                        <CircleOff className="w-3 h-3" />Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleToggleActive(c)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                      >
                        {c.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <Link
                        href={`/contractors/${c.id}`}
                        className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                      >
                        View <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
