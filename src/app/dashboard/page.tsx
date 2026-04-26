'use client';

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CATEGORIES } from '@/lib/categoryConstants';
import { getCategoryColor } from '@/lib/categoryColors';
import { TrendingDown, TrendingUp, Wallet, Clock } from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Transaction {
  amount: number;
  category: string;
}

export default function DashboardPage() {
  const { data: txData } = useSWR('/api/transactions?limit=10000', fetcher);
  const { data: forecast } = useSWR('/api/forecast?months=3', fetcher);

  const transactions: Transaction[] = txData?.transactions ?? [];

  const totalExpenses = transactions
    .filter(t => t.amount < 0 && t.category !== 'internal_transfers')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const totalRevenue = transactions
    .filter(t => t.amount > 0 && t.category === 'revenue')
    .reduce((s, t) => s + t.amount, 0);

  const net = totalRevenue - totalExpenses;

  const catTotals: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount < 0 && t.category && t.category !== 'internal_transfers') {
      catTotals[t.category] = (catTotals[t.category] ?? 0) + Math.abs(t.amount);
    }
  }
  const pieData = Object.entries(catTotals)
    .map(([cat, v]) => ({ name: CATEGORIES.find(c => c.slug === cat)?.label ?? cat, value: v, slug: cat }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-100">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4 flex-row items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <CardTitle className="text-xs text-gray-400 font-normal">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-red-400">${totalExpenses.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4 flex-row items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-xs text-gray-400 font-normal">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-emerald-400">${totalRevenue.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4 flex-row items-center gap-2">
            <Wallet className="w-4 h-4 text-sky-400" />
            <CardTitle className="text-xs text-gray-400 font-normal">Net Position</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-2xl font-semibold ${net < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              ${net.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4 flex-row items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <CardTitle className="text-xs text-gray-400 font-normal">Runway</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-amber-400">
              {forecast?.runway != null ? `${forecast.runway}mo` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending donut */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Spending Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" nameKey="name">
                  {pieData.map(entry => (
                    <Cell key={entry.slug} fill={getCategoryColor(entry.slug)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`$${typeof v === 'number' ? v.toLocaleString('en-AU') : v}`, '']}
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {pieData.slice(0, 6).map(d => (
                <div key={d.slug} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(d.slug) }} />
                  <span className="truncate">{d.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top categories table */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Top Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pieData.map((d, i) => (
                <div key={d.slug} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-4">{i + 1}</span>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getCategoryColor(d.slug) }} />
                  <span className="flex-1 text-sm text-gray-300 truncate">{d.name}</span>
                  <span className="text-sm font-mono text-gray-200">${d.value.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</span>
                  <span className="text-xs text-gray-500 w-10 text-right">{totalExpenses > 0 ? Math.round(d.value / totalExpenses * 100) : 0}%</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-800">
              <Link href="/charts" className="text-xs text-violet-400 hover:text-violet-300">View all charts →</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
