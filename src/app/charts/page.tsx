'use client';

import useSWR from 'swr';
import { useState, useRef, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  Bar, XAxis, YAxis, CartesianGrid,
  Area, AreaChart, BarChart,
} from 'recharts';
import { CATEGORIES } from '@/lib/categoryConstants';
import { getCategoryColor } from '@/lib/categoryColors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Pencil, Download } from 'lucide-react';
import {
  exportPlPdf,
  exportBsPdf,
  exportMonthlySpendPdf,
  exportBreakdownPdf,
} from '@/lib/charts/exportPdf';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function buildUrl(p: Record<string, string>) {
  const q = new URLSearchParams(p);
  return `/api/transactions?${q}&limit=10000`;
}

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "2025-04" → "Apr '25" */
function fmtMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} '${String(y).slice(2)}`;
}

function toYM(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) { m = 1; y++; }
  }
  return months;
}

function buildMonthlyTable(transactions: Transaction[], months: string[]) {
  const monthSet = new Set(months);
  // cat → sub → month → total
  const catMap: Record<string, Record<string, Record<string, number>>> = {};
  for (const t of transactions) {
    const mo = t.date.slice(0, 7);
    if (!monthSet.has(mo)) continue;
    const cat = t.category ?? 'other_expenses';
    const sub = t.subcategory ?? 'miscellaneous';
    if (!catMap[cat]) catMap[cat] = {};
    if (!catMap[cat][sub]) catMap[cat][sub] = {};
    catMap[cat][sub][mo] = (catMap[cat][sub][mo] ?? 0) + t.amount;
  }
  return CATEGORIES
    .map(c => {
      const subcats = c.subcategories.map(s => {
        const subMap = catMap[c.slug]?.[s.slug] ?? {};
        const byMonth = months.map(mo => subMap[mo] ?? 0);
        const total = byMonth.reduce((a, b) => a + b, 0);
        return { slug: s.slug, label: s.label, byMonth, total };
      }).filter(s => s.byMonth.some(v => v !== 0));
      const byMonth = months.map((_, i) => subcats.reduce((s, sub) => s + sub.byMonth[i], 0));
      const total = byMonth.reduce((a, b) => a + b, 0);
      return { slug: c.slug, label: c.label, isExpense: c.isExpense, byMonth, total, subcats };
    })
    .filter(r => r.byMonth.some(v => v !== 0));
}

/** Month-end account balance: last transaction in or before `mo` that has a balance value. */
function getMonthEndBalance(srcTxns: Transaction[], mo: string): number | null {
  let result: number | null = null;
  for (const t of srcTxns) {
    if (t.date.slice(0, 7) > mo) break; // array must be sorted asc by date
    if (t.balance != null) result = t.balance;
  }
  return result;
}

const SOURCE_LABEL: Record<string, string> = { nab: 'NAB', wise: 'Wise' };
function fmtSource(src: string) {
  return (SOURCE_LABEL[src] ?? src.toUpperCase()) + ' — Cash';
}

function defaultRange() {
  const now = new Date();
  const end = toYM(now);
  const start = toYM(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  return { start, end };
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  balance?: number | null;
  category: string | null;
  subcategory: string | null;
  transactionDetails: string | null;
  merchantName: string | null;
  notes: string | null;
  source: string;
}

// Build a nested map: category → subcategory → { total, count }
function buildBreakdown(transactions: Transaction[]) {
  const map: Record<string, Record<string, { total: number; count: number }>> = {};

  for (const t of transactions) {
    const cat = t.category ?? 'other_expenses';
    const sub = t.subcategory ?? 'miscellaneous';
    if (!map[cat]) map[cat] = {};
    if (!map[cat][sub]) map[cat][sub] = { total: 0, count: 0 };
    map[cat][sub].total += t.amount;
    map[cat][sub].count++;
  }

  // Roll up to category totals, ordered by CATEGORIES definition
  return CATEGORIES.map(catDef => {
    const subcats = catDef.subcategories.map(subDef => ({
      slug: subDef.slug,
      label: subDef.label,
      total: map[catDef.slug]?.[subDef.slug]?.total ?? 0,
      count: map[catDef.slug]?.[subDef.slug]?.count ?? 0,
    })).filter(s => s.count > 0);

    const total = subcats.reduce((s, r) => s + r.total, 0);
    const count = subcats.reduce((s, r) => s + r.count, 0);
    return { slug: catDef.slug, label: catDef.label, isExpense: catDef.isExpense, total, count, subcats };
  }).filter(c => c.count > 0);
}

/**
 * Wraps a horizontally scrollable area and attaches a sticky mirror scrollbar
 * at the bottom of the viewport so the user never has to scroll to the bottom
 * of a tall table just to find the scrollbar.
 */
function StickyScrollX({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const mirror = mirrorRef.current;
    const inner = innerRef.current;
    if (!outer || !mirror || !inner) return;

    const phantom = mirror.firstElementChild as HTMLElement;

    // Keep phantom width in sync with actual table width
    const updateWidth = () => { phantom.style.width = inner.scrollWidth + 'px'; };
    const ro = new ResizeObserver(updateWidth);
    ro.observe(inner);
    updateWidth();

    // Sync scroll positions in both directions
    const onOuter = () => { mirror.scrollLeft = outer.scrollLeft; };
    const onMirror = () => { outer.scrollLeft = mirror.scrollLeft; };
    outer.addEventListener('scroll', onOuter);
    mirror.addEventListener('scroll', onMirror);

    return () => {
      outer.removeEventListener('scroll', onOuter);
      mirror.removeEventListener('scroll', onMirror);
      ro.disconnect();
    };
  }, []);

  return (
    <div>
      {/* Content — native scrollbar hidden so only the sticky one shows */}
      <div
        ref={outerRef}
        style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        <div ref={innerRef}>{children}</div>
      </div>

      {/* Sticky mirror scrollbar — sticks to bottom of viewport while page scrolls */}
      <div
        ref={mirrorRef}
        className={[
          'overflow-x-auto sticky bottom-0 z-20',
          'bg-gray-800 border-t border-gray-700',
          // Firefox
          '[scrollbar-color:#6b7280_#1f2937]',
          // Webkit — track + thumb
          '[&::-webkit-scrollbar]:h-3',
          '[&::-webkit-scrollbar-track]:bg-gray-800',
          '[&::-webkit-scrollbar-thumb]:bg-gray-500',
          '[&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb:hover]:bg-gray-400',
        ].join(' ')}
        style={{ height: 16 }}
      >
        {/* phantom element whose width matches the table — makes the scrollbar appear */}
        <div style={{ height: 1 }} />
      </div>
    </div>
  );
}

export default function ChartsPage() {
  const router = useRouter();
  const [source, setSource] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drilled, setDrilled] = useState<Record<string, boolean>>({});
  const [tableRange, setTableRange] = useState(defaultRange);
  const [mtOpen, setMtOpen] = useState<Record<string, boolean>>({});
  const [mtSubOpen, setMtSubOpen] = useState<Record<string, boolean>>({});
  const [plRange, setPlRange] = useState(defaultRange);
  const [plCatOpen, setPlCatOpen] = useState<Record<string, boolean>>({});

  const params: Record<string, string> = {};
  if (source) params.source = source;
  if (selectedCat) params.category = selectedCat;

  const { data } = useSWR(buildUrl(params), fetcher, { revalidateOnFocus: true, revalidateOnMount: true });
  const transactions: Transaction[] = data?.transactions ?? [];

  // ── Chart data ──────────────────────────────────────────────────────────────

  const catTotals: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount < 0 && t.category !== 'internal_transfers') {
      catTotals[t.category ?? 'other_expenses'] = (catTotals[t.category ?? 'other_expenses'] ?? 0) + Math.abs(t.amount);
    }
  }
  const pieData = Object.entries(catTotals)
    .map(([cat, total]) => ({ name: CATEGORIES.find(c => c.slug === cat)?.label ?? cat, value: total, slug: cat }))
    .sort((a, b) => b.value - a.value);

  const monthMap: Record<string, { expenses: number; revenue: number }> = {};
  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    if (!monthMap[month]) monthMap[month] = { expenses: 0, revenue: 0 };
    if (t.amount < 0 && t.category !== 'internal_transfers') monthMap[month].expenses += Math.abs(t.amount);
    if (t.amount > 0) monthMap[month].revenue += t.amount;
  }
  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, Expenses: Math.round(v.expenses), Revenue: Math.round(v.revenue) }));

  const allMonths = [...new Set(transactions.map(t => t.date.slice(0, 7)))].sort();
  const allCats = Object.keys(catTotals);
  const stackedData = allMonths.map(month => {
    const row: Record<string, string | number> = { month };
    for (const cat of allCats) {
      const total = transactions
        .filter(t => t.date.startsWith(month) && t.category === cat && t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      if (total > 0) row[CATEGORIES.find(c => c.slug === cat)?.label ?? cat] = Math.round(total);
    }
    return row;
  });

  const totalExpenses = pieData.reduce((s, d) => s + d.value, 0);
  const totalRevenue = transactions.filter(t => t.amount > 0 && t.category !== 'internal_transfers').reduce((s, t) => s + t.amount, 0);
  const net = totalRevenue - totalExpenses;

  // ── Breakdown table ──────────────────────────────────────────────────────────
  const breakdown = buildBreakdown(transactions);
  const grandExpenses = breakdown.filter(c => c.isExpense).reduce((s, c) => s + Math.abs(c.total), 0);

  // ── Monthly spend table ─────────────────────────────────────────────────────
  const tableMonthCols = getMonthsBetween(tableRange.start, tableRange.end);
  const monthlyTable = buildMonthlyTable(transactions, tableMonthCols);

  // ── P&L table ────────────────────────────────────────────────────────────────
  const plMonthCols = getMonthsBetween(plRange.start, plRange.end);
  const plTable = buildMonthlyTable(transactions, plMonthCols);
  const plRevRows = plTable.filter(r => !r.isExpense && r.slug !== 'internal_transfers');
  const plExpRows = plTable.filter(r => r.isExpense);
  const plRevByMonth = plMonthCols.map((_, i) => plRevRows.reduce((s, r) => s + r.byMonth[i], 0));
  const plExpByMonth = plMonthCols.map((_, i) => plExpRows.reduce((s, r) => s + Math.abs(r.byMonth[i]), 0));
  const plNetByMonth = plMonthCols.map((_, i) => plRevByMonth[i] - plExpByMonth[i]);
  const plTotalRev = plRevByMonth.reduce((a, b) => a + b, 0);
  const plTotalExp = plExpByMonth.reduce((a, b) => a + b, 0);
  const plTotalNet = plTotalRev - plTotalExp;

  function applyPlPreset(months: number) {
    const now = new Date();
    setPlRange({ end: toYM(now), start: toYM(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)) });
  }

  // ── Balance Sheet ─────────────────────────────────────────────────────────────
  const [bsRange, setBsRange] = useState(defaultRange);

  const bsMonthCols = getMonthsBetween(bsRange.start, bsRange.end);

  // Group + sort transactions by source for O(n) month-end balance lookups
  const bsSrcMap: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    if (!bsSrcMap[t.source]) bsSrcMap[t.source] = [];
    bsSrcMap[t.source].push(t);
  }
  for (const src of Object.keys(bsSrcMap)) {
    bsSrcMap[src].sort((a, b) => a.date.localeCompare(b.date));
  }
  const bsSources = Object.keys(bsSrcMap).sort();

  // All transactions sorted chronologically for cumulative retained earnings
  const bsAllSorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  const bsData = bsMonthCols.map(mo => {
    const cashBySrc: Record<string, number | null> = {};
    let totalCash = 0;
    let anyCash = false;
    for (const src of bsSources) {
      const bal = getMonthEndBalance(bsSrcMap[src] ?? [], mo);
      cashBySrc[src] = bal;
      if (bal !== null) { totalCash += bal; anyCash = true; }
    }
    // Cumulative retained earnings = all revenue − all expenses from inception through mo
    let retained = 0;
    for (const t of bsAllSorted) {
      if (t.date.slice(0, 7) > mo) break;
      if (t.category !== 'internal_transfers') retained += t.amount;
    }
    return { mo, cashBySrc, totalCash: anyCash ? totalCash : null, retainedEarnings: retained };
  });

  function applyBsPreset(months: number) {
    const now = new Date();
    setBsRange({ end: toYM(now), start: toYM(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)) });
  }

  function applyPreset(months: number) {
    const now = new Date();
    setTableRange({
      end: toYM(now),
      start: toYM(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)),
    });
  }

  const toggle = (slug: string) => setCollapsed(p => ({ ...p, [slug]: !p[slug] }));
  const toggleDrill = (key: string) => setDrilled(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Charts</h1>
        <div className="flex gap-3">
          <Select value={source || 'all'} onValueChange={v => setSource(v === 'all' ? '' : (v ?? ''))}>
            <SelectTrigger className="w-32 bg-gray-900 border-gray-700 text-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="all" className="text-gray-200">All accounts</SelectItem>
              <SelectItem value="nab" className="text-gray-200">NAB</SelectItem>
              <SelectItem value="wise" className="text-gray-200">Wise</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCat || 'all'} onValueChange={v => setSelectedCat(v === 'all' ? '' : (v ?? ''))}>
            <SelectTrigger className="w-44 bg-gray-900 border-gray-700 text-gray-200">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="all" className="text-gray-200">All categories</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c.slug} value={c.slug} className="text-gray-200">{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs text-gray-400 font-normal">Total Expenses</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4"><p className="text-2xl font-semibold text-red-400">${fmt(totalExpenses)}</p></CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs text-gray-400 font-normal">Total Revenue</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4"><p className="text-2xl font-semibold text-emerald-400">${fmt(totalRevenue)}</p></CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4"><CardTitle className="text-xs text-gray-400 font-normal">Net</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-2xl font-semibold ${net < 0 ? 'text-red-400' : 'text-emerald-400'}`}>${fmt(net)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-300">Spending by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name">
                  {pieData.map(e => <Cell key={e.slug} fill={getCategoryColor(e.slug)} />)}
                </Pie>
                <Tooltip formatter={(v) => [`$${typeof v === 'number' ? fmt(v) : v}`, 'Spend']} contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-300">Revenue vs Expenses</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} /><stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`$${typeof v === 'number' ? fmt(v) : v}`, '']} contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
                <Area type="monotone" dataKey="Revenue" stroke="#22c55e" fill="url(#rev)" strokeWidth={2} />
                <Area type="monotone" dataKey="Expenses" stroke="#f43f5e" fill="url(#exp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stacked monthly bar */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-300">Monthly Spending by Category</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 10 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`$${typeof v === 'number' ? fmt(v) : v}`, '']} contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              {allCats.map(cat => (
                <Bar key={cat} dataKey={CATEGORIES.find(c => c.slug === cat)?.label ?? cat} stackId="a" fill={getCategoryColor(cat)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Breakdown table ─────────────────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3 pt-5 px-5 flex-row items-center justify-between">
          <CardTitle className="text-sm text-gray-300">Category &amp; Subcategory Breakdown</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{transactions.length} transactions</span>
            <button
              onClick={() => exportBreakdownPdf({ rows: breakdown, grandExpenses, totalRevenue })}
              title="Export to PDF"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors">
              <Download className="w-3 h-3" />PDF
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-2.5 font-medium">Category / Subcategory</th>
                <th className="text-right px-5 py-2.5 font-medium w-32">Transactions</th>
                <th className="text-right px-5 py-2.5 font-medium w-40">Amount (AUD)</th>
                <th className="text-right px-5 py-2.5 font-medium w-24">% of Spend</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map(cat => {
                const isOpen = !collapsed[cat.slug];
                const absTotal = Math.abs(cat.total);
                const pct = grandExpenses > 0 && cat.isExpense ? (absTotal / grandExpenses * 100) : null;
                const amountColor = cat.total < 0 ? 'text-red-400' : 'text-emerald-400';

                return [
                  /* Category row */
                  <tr
                    key={cat.slug}
                    className="border-b border-gray-800 hover:bg-gray-800/40 cursor-pointer select-none"
                    onClick={() => toggle(cat.slug)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-gray-500 w-3.5 shrink-0">
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ background: getCategoryColor(cat.slug) }}
                        />
                        <span className="font-semibold text-gray-100" style={{ fontFamily: 'var(--font-heading)' }}>
                          {cat.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400 tabular-nums">{cat.count}</td>
                    <td className={cn('px-5 py-3 text-right font-mono tabular-nums font-medium', amountColor)}>
                      {cat.total < 0 ? '-' : '+'}${fmt(absTotal)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400 tabular-nums">
                      {pct != null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-gray-400">{pct.toFixed(1)}%</span>
                          <span
                            className="inline-block h-1.5 rounded-full"
                            style={{ width: `${Math.max(2, pct)}px`, background: getCategoryColor(cat.slug), minWidth: '2px', maxWidth: '48px' }}
                          />
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                  </tr>,

                  /* Subcategory rows */
                  ...(isOpen ? cat.subcats.flatMap(sub => {
                    const subAbs = Math.abs(sub.total);
                    const subPct = grandExpenses > 0 && cat.isExpense ? (subAbs / grandExpenses * 100) : null;
                    const subColor = sub.total < 0 ? 'text-red-300' : 'text-emerald-300';
                    const drillKey = `${cat.slug}-${sub.slug}`;
                    const isDrilled = !!drilled[drillKey];

                    // Transactions that belong to this subcategory, sorted newest first
                    const subTxns = transactions
                      .filter(t => (t.category ?? 'other_expenses') === cat.slug && (t.subcategory ?? 'miscellaneous') === sub.slug)
                      .sort((a, b) => b.date.localeCompare(a.date));

                    return [
                      /* Subcategory summary row */
                      <tr
                        key={drillKey}
                        className="border-b border-gray-800/60 hover:bg-gray-800/30 cursor-pointer select-none"
                        onClick={() => toggleDrill(drillKey)}
                      >
                        <td className="px-5 py-2">
                          <div className="flex items-center gap-2 pl-6">
                            <span className="text-gray-600 w-3 shrink-0">
                              {isDrilled ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </span>
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full shrink-0 opacity-60"
                              style={{ background: getCategoryColor(cat.slug) }}
                            />
                            <span className="text-gray-400">{sub.label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-2 text-right text-gray-500 tabular-nums text-xs">{sub.count}</td>
                        <td className={cn('px-5 py-2 text-right font-mono tabular-nums text-sm', subColor)}>
                          {sub.total < 0 ? '-' : '+'}${fmt(subAbs)}
                        </td>
                        <td className="px-5 py-2 text-right text-gray-500 tabular-nums text-xs">
                          {subPct != null ? `${subPct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>,

                      /* Transaction rows (drill-down) */
                      ...(isDrilled ? subTxns.map(t => {
                        const desc = t.merchantName || t.transactionDetails || '—';
                        const txColor = t.amount < 0 ? 'text-red-300/80' : 'text-emerald-300/80';
                        return (
                          <tr key={t.id} className="border-b border-gray-800/30 bg-gray-950/60 hover:bg-gray-900/60 group">
                            <td className="px-5 py-1.5">
                              <div className="flex items-center gap-2 pl-14 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="text-gray-500 truncate text-xs leading-relaxed">{desc}</div>
                                  {t.notes && (
                                    <div className="text-amber-300/80 text-[10px] italic truncate mt-0.5" title={t.notes}>
                                      {t.notes}
                                    </div>
                                  )}
                                </div>
                                <span className={cn(
                                  'shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide',
                                  t.source === 'nab'
                                    ? 'bg-blue-900/50 text-blue-400'
                                    : 'bg-violet-900/50 text-violet-400'
                                )}>
                                  {t.source}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-1.5 text-right text-gray-600 tabular-nums text-xs">
                              {t.date.slice(0, 10)}
                            </td>
                            <td className={cn('px-5 py-1.5 text-right font-mono tabular-nums text-xs', txColor)}>
                              {t.amount < 0 ? '-' : '+'}${fmt(Math.abs(t.amount))}
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <button
                                title="View & edit in Transactions"
                                onClick={e => { e.stopPropagation(); router.push(`/transactions?highlight=${t.id}`); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-violet-900/50 text-violet-400 hover:text-violet-300"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      }) : []),
                    ];
                  }) : []),
                ];
              })}

              {/* Grand total */}
              <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                <td className="px-5 py-3 font-semibold text-gray-200" style={{ fontFamily: 'var(--font-heading)' }}>
                  Total Expenses
                </td>
                <td className="px-5 py-3 text-right text-gray-300 tabular-nums">
                  {breakdown.filter(c => c.isExpense).reduce((s, c) => s + c.count, 0)}
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold text-red-400">
                  -${fmt(grandExpenses)}
                </td>
                <td className="px-5 py-3 text-right text-gray-400">100%</td>
              </tr>
              <tr className="border-t border-gray-800 bg-gray-800/30">
                <td className="px-5 py-3 font-semibold text-gray-200" style={{ fontFamily: 'var(--font-heading)' }}>
                  Total Revenue
                </td>
                <td className="px-5 py-3 text-right text-gray-300 tabular-nums">
                  {breakdown.filter(c => !c.isExpense).reduce((s, c) => s + c.count, 0)}
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold text-emerald-400">
                  +${fmt(totalRevenue)}
                </td>
                <td className="px-5 py-3 text-right text-gray-600">—</td>
              </tr>
              <tr className="border-t-2 border-gray-700 bg-gray-900">
                <td className="px-5 py-3 font-bold text-gray-100" style={{ fontFamily: 'var(--font-heading)' }}>
                  Net Position
                </td>
                <td />
                <td className={cn('px-5 py-3 text-right font-mono tabular-nums font-bold text-lg', net < 0 ? 'text-red-400' : 'text-emerald-400')}>
                  {net < 0 ? '-' : '+'}${fmt(Math.abs(net))}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
      {/* ── Monthly Spend by Category table ──────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-sm text-gray-300">Monthly Spend by Category</CardTitle>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Preset buttons */}
              {([3, 6, 12] as const).map(n => {
                const presetEnd = toYM(new Date());
                const presetStart = toYM(new Date(new Date().getFullYear(), new Date().getMonth() - (n - 1), 1));
                const active = tableRange.start === presetStart && tableRange.end === presetEnd;
                return (
                  <button
                    key={n}
                    onClick={() => applyPreset(n)}
                    className={cn(
                      'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                      active
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200',
                    )}
                  >
                    {n}M
                  </button>
                );
              })}

              <span className="text-gray-700 text-xs">|</span>

              {/* Custom from/to */}
              <label className="text-xs text-gray-500">From</label>
              <input
                type="month"
                value={tableRange.start}
                onChange={e => setTableRange(r => ({ ...r, start: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-violet-500"
              />
              <label className="text-xs text-gray-500">To</label>
              <input
                type="month"
                value={tableRange.end}
                onChange={e => setTableRange(r => ({ ...r, end: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-violet-500"
              />
              <span className="text-gray-700 text-xs">|</span>
              <button
                onClick={() => exportMonthlySpendPdf({ monthCols: tableMonthCols, rows: monthlyTable })}
                title="Export to PDF"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors">
                <Download className="w-3 h-3" />PDF
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
        <StickyScrollX>
          <table className="w-full text-sm min-w-max">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-2.5 font-medium sticky left-0 bg-gray-900 z-10 min-w-[300px]">
                  Category
                </th>
                {tableMonthCols.map(mo => (
                  <th key={mo} className="text-right px-4 py-2.5 font-medium min-w-[110px] whitespace-nowrap">
                    {fmtMonth(mo)}
                  </th>
                ))}
                <th className="text-right px-5 py-2.5 font-medium min-w-[120px] border-l border-gray-800">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlyTable.length === 0 ? (
                <tr>
                  <td colSpan={tableMonthCols.length + 2} className="px-5 py-8 text-center text-gray-600 text-sm">
                    No transactions in this date range
                  </td>
                </tr>
              ) : (
                <>
                  {monthlyTable.flatMap(row => {
                    const amtColor = row.isExpense ? 'text-red-400' : 'text-emerald-400';
                    const isCatOpen = !!mtOpen[row.slug];

                    // ── Category row ────────────────────────────────────────────
                    const catRow = (
                      <tr
                        key={row.slug}
                        className="border-b border-gray-800/60 hover:bg-gray-800/30 cursor-pointer select-none"
                        onClick={() => setMtOpen(p => ({ ...p, [row.slug]: !p[row.slug] }))}
                      >
                        <td className="px-5 py-2.5 sticky left-0 bg-gray-900 z-10">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 w-3 shrink-0">
                              {isCatOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </span>
                            <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: getCategoryColor(row.slug) }} />
                            <span className="text-gray-300 font-medium text-xs" style={{ fontFamily: 'var(--font-heading)' }}>
                              {row.label}
                            </span>
                          </div>
                        </td>
                        {row.byMonth.map((amt, i) => (
                          <td key={tableMonthCols[i]} className="px-4 py-2.5 text-right tabular-nums font-mono text-xs">
                            {amt === 0 ? <span className="text-gray-700">—</span> : (
                              <span className={amt < 0 ? 'text-red-400/90' : 'text-emerald-400/90'}>
                                {amt < 0 ? '-' : '+'}${fmt(Math.abs(amt))}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className={cn('px-5 py-2.5 text-right tabular-nums font-mono text-xs font-semibold border-l border-gray-800', amtColor)}>
                          {row.total < 0 ? '-' : '+'}${fmt(Math.abs(row.total))}
                        </td>
                      </tr>
                    );

                    if (!isCatOpen) return [catRow];

                    // ── Subcategory rows ─────────────────────────────────────────
                    const subRows = row.subcats.flatMap(sub => {
                      const subKey = `${row.slug}__${sub.slug}`;
                      const isSubOpen = !!mtSubOpen[subKey];

                      const subRow = (
                        <tr
                          key={subKey}
                          className="border-b border-gray-800/40 hover:bg-gray-800/20 cursor-pointer select-none"
                          onClick={() => setMtSubOpen(p => ({ ...p, [subKey]: !p[subKey] }))}
                        >
                          <td className="px-5 py-2 sticky left-0 bg-gray-900 z-10">
                            <div className="flex items-center gap-2 pl-6">
                              <span className="text-gray-600 w-3 shrink-0">
                                {isSubOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </span>
                              <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 opacity-60" style={{ background: getCategoryColor(row.slug) }} />
                              <span className="text-gray-400 text-xs">{sub.label}</span>
                            </div>
                          </td>
                          {sub.byMonth.map((amt, i) => (
                            <td key={tableMonthCols[i]} className="px-4 py-2 text-right tabular-nums font-mono text-xs">
                              {amt === 0 ? <span className="text-gray-800">—</span> : (
                                <span className={amt < 0 ? 'text-red-400/70' : 'text-emerald-400/70'}>
                                  {amt < 0 ? '-' : '+'}${fmt(Math.abs(amt))}
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="px-5 py-2 text-right tabular-nums font-mono text-xs border-l border-gray-800">
                            <span className={sub.total < 0 ? 'text-red-400/70' : 'text-emerald-400/70'}>
                              {sub.total < 0 ? '-' : '+'}${fmt(Math.abs(sub.total))}
                            </span>
                          </td>
                        </tr>
                      );

                      if (!isSubOpen) return [subRow];

                      // ── Transaction rows ──────────────────────────────────────
                      const txns = transactions
                        .filter(t =>
                          (t.category ?? 'other_expenses') === row.slug &&
                          (t.subcategory ?? 'miscellaneous') === sub.slug &&
                          tableMonthCols.includes(t.date.slice(0, 7)),
                        )
                        .sort((a, b) => b.date.localeCompare(a.date));

                      const txRows = txns.map(t => {
                        const desc = t.merchantName || t.transactionDetails || '—';
                        const txMo = t.date.slice(0, 7);
                        return (
                          <tr key={t.id} className="border-b border-gray-800/20 bg-gray-950/70 hover:bg-gray-900/60 group">
                            <td className="px-5 py-1.5 sticky left-0 bg-gray-950/70 z-10 min-w-0">
                              <div className="flex items-center gap-2 pl-14 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="text-gray-500 truncate text-xs">{desc}</div>
                                  {t.notes && (
                                    <div className="text-amber-300/80 text-[10px] italic truncate mt-0.5" title={t.notes}>
                                      {t.notes}
                                    </div>
                                  )}
                                </div>
                                <span className={cn(
                                  'shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide',
                                  t.source === 'nab' ? 'bg-blue-900/50 text-blue-400' : 'bg-violet-900/50 text-violet-400',
                                )}>
                                  {t.source}
                                </span>
                                <button
                                  title="View & edit in Transactions"
                                  onClick={e => { e.stopPropagation(); router.push(`/transactions?highlight=${t.id}`); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-violet-900/50 text-violet-400 hover:text-violet-300"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            {tableMonthCols.map(mo => (
                              <td key={mo} className="px-4 py-1.5 text-right tabular-nums font-mono text-xs">
                                {mo === txMo ? (
                                  <span className={t.amount < 0 ? 'text-red-300/70' : 'text-emerald-300/70'}>
                                    {t.amount < 0 ? '-' : '+'}${fmt(Math.abs(t.amount))}
                                  </span>
                                ) : (
                                  <span className="text-gray-800 text-[10px]">·</span>
                                )}
                              </td>
                            ))}
                            <td className="px-5 py-1.5 text-right tabular-nums font-mono text-xs border-l border-gray-800/50">
                              <span className={t.amount < 0 ? 'text-red-300/70' : 'text-emerald-300/70'}>
                                {t.date.slice(0, 10)}
                              </span>
                            </td>
                          </tr>
                        );
                      });

                      return [subRow, ...txRows];
                    });

                    return [catRow, ...subRows];
                  })}

                  {/* Column totals footer */}
                  <tr className="border-t-2 border-gray-700 bg-gray-800/50 font-semibold">
                    <td className="px-5 py-3 sticky left-0 bg-gray-800/50 z-10 text-gray-300 text-xs"
                        style={{ fontFamily: 'var(--font-heading)' }}>
                      Total
                    </td>
                    {tableMonthCols.map(mo => {
                      const colSum = monthlyTable.reduce((s, row) => {
                        const i = tableMonthCols.indexOf(mo);
                        return s + (row.byMonth[i] ?? 0);
                      }, 0);
                      return (
                        <td key={mo} className="px-4 py-3 text-right tabular-nums font-mono text-xs">
                          {colSum === 0 ? (
                            <span className="text-gray-600">—</span>
                          ) : (
                            <span className={colSum < 0 ? 'text-red-300' : 'text-emerald-300'}>
                              {colSum < 0 ? '-' : '+'}${fmt(Math.abs(colSum))}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-5 py-3 text-right tabular-nums font-mono text-xs border-l border-gray-800">
                      {(() => {
                        const grand = monthlyTable.reduce((s, r) => s + r.total, 0);
                        return (
                          <span className={grand < 0 ? 'text-red-300' : 'text-emerald-300'}>
                            {grand < 0 ? '-' : '+'}${fmt(Math.abs(grand))}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </StickyScrollX>
        </CardContent>
      </Card>

      {/* ── P&L Statement ───────────────────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm text-gray-300">Profit &amp; Loss Statement</CardTitle>
              <p className="text-xs text-gray-600 mt-0.5">Revenue, expenses and net position by period</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {([3, 6, 12] as const).map(n => {
                const pEnd = toYM(new Date());
                const pStart = toYM(new Date(new Date().getFullYear(), new Date().getMonth() - (n - 1), 1));
                const active = plRange.start === pStart && plRange.end === pEnd;
                return (
                  <button key={n} onClick={() => applyPlPreset(n)}
                    className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors',
                      active ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200')}>
                    {n}M
                  </button>
                );
              })}
              <span className="text-gray-700 text-xs">|</span>
              <label className="text-xs text-gray-500">From</label>
              <input type="month" value={plRange.start}
                onChange={e => setPlRange(r => ({ ...r, start: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-violet-500" />
              <label className="text-xs text-gray-500">To</label>
              <input type="month" value={plRange.end}
                onChange={e => setPlRange(r => ({ ...r, end: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-violet-500" />
              <span className="text-gray-700 text-xs">|</span>
              <button
                onClick={() => exportPlPdf({
                  monthCols: plMonthCols,
                  revRows: plRevRows,
                  expRows: plExpRows,
                  revByMonth: plRevByMonth,
                  expByMonth: plExpByMonth,
                  netByMonth: plNetByMonth,
                  totalRev: plTotalRev,
                  totalExp: plTotalExp,
                  totalNet: plTotalNet,
                })}
                title="Export to PDF"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors">
                <Download className="w-3 h-3" />PDF
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <StickyScrollX>
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5 font-medium sticky left-0 bg-gray-900 z-10 min-w-[280px]">Item</th>
                  {plMonthCols.map(mo => (
                    <th key={mo} className="text-right px-4 py-2.5 font-medium min-w-[110px] whitespace-nowrap">{fmtMonth(mo)}</th>
                  ))}
                  <th className="text-right px-5 py-2.5 font-medium min-w-[120px] border-l border-gray-800">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-emerald-950/30 border-b border-emerald-900/40">
                  <td className="px-5 py-2 sticky left-0 bg-emerald-950/30 z-10" colSpan={1}>
                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Revenue</span>
                  </td>
                  {plMonthCols.map(mo => <td key={mo} />)}
                  <td className="border-l border-gray-800" />
                </tr>
                {plRevRows.length === 0 ? (
                  <tr className="border-b border-gray-800">
                    <td className="px-5 py-3 text-gray-600 text-xs italic sticky left-0 bg-gray-900 z-10">No revenue in this period</td>
                    {plMonthCols.map(mo => <td key={mo} />)}
                    <td className="border-l border-gray-800" />
                  </tr>
                ) : plRevRows.flatMap(row => {
                  const isOpen = !!plCatOpen[row.slug];
                  const catRows = [
                    <tr key={row.slug}
                      className="border-b border-gray-800/60 hover:bg-gray-800/30 cursor-pointer select-none"
                      onClick={() => setPlCatOpen(p => ({ ...p, [row.slug]: !p[row.slug] }))}>
                      <td className="px-5 py-2.5 sticky left-0 bg-gray-900 z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 w-3 shrink-0">{isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
                          <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: getCategoryColor(row.slug) }} />
                          <span className="text-gray-200 text-xs font-medium" style={{ fontFamily: 'var(--font-heading)' }}>{row.label}</span>
                        </div>
                      </td>
                      {row.byMonth.map((amt, i) => (
                        <td key={plMonthCols[i]} className="px-4 py-2.5 text-right tabular-nums font-mono text-xs">
                          {amt === 0 ? <span className="text-gray-700">—</span> : <span className="text-emerald-400/90">+${fmt(amt)}</span>}
                        </td>
                      ))}
                      <td className="px-5 py-2.5 text-right tabular-nums font-mono text-xs font-semibold text-emerald-400 border-l border-gray-800">
                        +${fmt(row.total)}
                      </td>
                    </tr>
                  ];
                  if (!isOpen) return catRows;
                  const subRows = row.subcats.map(sub => (
                    <tr key={`${row.slug}-${sub.slug}`} className="border-b border-gray-800/30 bg-gray-950/40">
                      <td className="px-5 py-2 sticky left-0 bg-gray-950/40 z-10">
                        <div className="flex items-center gap-2 pl-7">
                          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 opacity-50" style={{ background: getCategoryColor(row.slug) }} />
                          <span className="text-gray-400 text-xs">{sub.label}</span>
                        </div>
                      </td>
                      {sub.byMonth.map((amt, i) => (
                        <td key={plMonthCols[i]} className="px-4 py-2 text-right tabular-nums font-mono text-xs">
                          {amt === 0 ? <span className="text-gray-800">—</span> : <span className="text-emerald-400/60">+${fmt(amt)}</span>}
                        </td>
                      ))}
                      <td className="px-5 py-2 text-right tabular-nums font-mono text-xs text-emerald-400/60 border-l border-gray-800">
                        +${fmt(sub.total)}
                      </td>
                    </tr>
                  ));
                  return [...catRows, ...subRows];
                })}
                <tr className="border-b-2 border-gray-700 bg-emerald-950/20">
                  <td className="px-5 py-3 font-semibold text-emerald-300 text-xs sticky left-0 bg-emerald-950/20 z-10"
                    style={{ fontFamily: 'var(--font-heading)' }}>Total Revenue</td>
                  {plRevByMonth.map((amt, i) => (
                    <td key={plMonthCols[i]} className="px-4 py-3 text-right tabular-nums font-mono text-xs font-semibold text-emerald-300">
                      {amt === 0 ? <span className="text-gray-600">—</span> : `+$${fmt(amt)}`}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right tabular-nums font-mono text-sm font-bold text-emerald-300 border-l border-gray-800">
                    +${fmt(plTotalRev)}
                  </td>
                </tr>
                <tr className="h-2 bg-gray-950"><td colSpan={plMonthCols.length + 2} /></tr>
                <tr className="bg-red-950/20 border-b border-red-900/30">
                  <td className="px-5 py-2 sticky left-0 bg-red-950/20 z-10">
                    <span className="text-red-400 text-xs font-bold uppercase tracking-widest">Operating Expenses</span>
                  </td>
                  {plMonthCols.map(mo => <td key={mo} />)}
                  <td className="border-l border-gray-800" />
                </tr>
                {plExpRows.length === 0 ? (
                  <tr className="border-b border-gray-800">
                    <td className="px-5 py-3 text-gray-600 text-xs italic sticky left-0 bg-gray-900 z-10">No expenses in this period</td>
                    {plMonthCols.map(mo => <td key={mo} />)}
                    <td className="border-l border-gray-800" />
                  </tr>
                ) : plExpRows.flatMap(row => {
                  const isOpen = !!plCatOpen[`exp-${row.slug}`];
                  const catRows = [
                    <tr key={`exp-${row.slug}`}
                      className="border-b border-gray-800/60 hover:bg-gray-800/30 cursor-pointer select-none"
                      onClick={() => setPlCatOpen(p => ({ ...p, [`exp-${row.slug}`]: !p[`exp-${row.slug}`] }))}>
                      <td className="px-5 py-2.5 sticky left-0 bg-gray-900 z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 w-3 shrink-0">{isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
                          <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ background: getCategoryColor(row.slug) }} />
                          <span className="text-gray-200 text-xs font-medium" style={{ fontFamily: 'var(--font-heading)' }}>{row.label}</span>
                        </div>
                      </td>
                      {row.byMonth.map((amt, i) => (
                        <td key={plMonthCols[i]} className="px-4 py-2.5 text-right tabular-nums font-mono text-xs">
                          {amt === 0 ? <span className="text-gray-700">—</span> : <span className="text-red-400/90">${fmt(Math.abs(amt))}</span>}
                        </td>
                      ))}
                      <td className="px-5 py-2.5 text-right tabular-nums font-mono text-xs font-semibold text-red-400 border-l border-gray-800">
                        ${fmt(Math.abs(row.total))}
                      </td>
                    </tr>
                  ];
                  if (!isOpen) return catRows;
                  const subRows = row.subcats.map(sub => (
                    <tr key={`exp-${row.slug}-${sub.slug}`} className="border-b border-gray-800/30 bg-gray-950/40">
                      <td className="px-5 py-2 sticky left-0 bg-gray-950/40 z-10">
                        <div className="flex items-center gap-2 pl-7">
                          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 opacity-50" style={{ background: getCategoryColor(row.slug) }} />
                          <span className="text-gray-400 text-xs">{sub.label}</span>
                        </div>
                      </td>
                      {sub.byMonth.map((amt, i) => (
                        <td key={plMonthCols[i]} className="px-4 py-2 text-right tabular-nums font-mono text-xs">
                          {amt === 0 ? <span className="text-gray-800">—</span> : <span className="text-red-400/60">${fmt(Math.abs(amt))}</span>}
                        </td>
                      ))}
                      <td className="px-5 py-2 text-right tabular-nums font-mono text-xs text-red-400/60 border-l border-gray-800">
                        ${fmt(Math.abs(sub.total))}
                      </td>
                    </tr>
                  ));
                  return [...catRows, ...subRows];
                })}
                <tr className="border-b-2 border-gray-700 bg-red-950/10">
                  <td className="px-5 py-3 font-semibold text-red-300 text-xs sticky left-0 bg-red-950/10 z-10"
                    style={{ fontFamily: 'var(--font-heading)' }}>Total Expenses</td>
                  {plExpByMonth.map((amt, i) => (
                    <td key={plMonthCols[i]} className="px-4 py-3 text-right tabular-nums font-mono text-xs font-semibold text-red-300">
                      {amt === 0 ? <span className="text-gray-600">—</span> : `$${fmt(amt)}`}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right tabular-nums font-mono text-sm font-bold text-red-300 border-l border-gray-800">
                    ${fmt(plTotalExp)}
                  </td>
                </tr>
                <tr className="h-1 bg-gray-950"><td colSpan={plMonthCols.length + 2} /></tr>
                <tr className="border-t-2 border-gray-600 bg-gray-800/60">
                  <td className="px-5 py-4 font-bold text-gray-100 sticky left-0 bg-gray-800/60 z-10"
                    style={{ fontFamily: 'var(--font-heading)' }}>Net Profit / (Loss)</td>
                  {plNetByMonth.map((amt, i) => (
                    <td key={plMonthCols[i]} className={cn('px-4 py-4 text-right tabular-nums font-mono text-xs font-bold',
                      amt < 0 ? 'text-red-300' : amt > 0 ? 'text-emerald-300' : 'text-gray-500')}>
                      {amt === 0 ? '—' : `${amt < 0 ? '(' : ''}$${fmt(Math.abs(amt))}${amt < 0 ? ')' : ''}`}
                    </td>
                  ))}
                  <td className={cn('px-5 py-4 text-right tabular-nums font-mono text-base font-bold border-l border-gray-700',
                    plTotalNet < 0 ? 'text-red-300' : plTotalNet > 0 ? 'text-emerald-300' : 'text-gray-500')}>
                    {plTotalNet < 0 ? `($${fmt(Math.abs(plTotalNet))})` : `$${fmt(plTotalNet)}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </StickyScrollX>
        </CardContent>
      </Card>

      {/* ── Balance Sheet ────────────────────────────────────────────────────── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm text-gray-300">Balance Sheet</CardTitle>
              <p className="text-xs text-gray-600 mt-0.5">Month-end cash position &amp; cumulative retained earnings</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {([3, 6, 12] as const).map(n => {
                const pEnd = toYM(new Date());
                const pStart = toYM(new Date(new Date().getFullYear(), new Date().getMonth() - (n - 1), 1));
                const active = bsRange.start === pStart && bsRange.end === pEnd;
                return (
                  <button key={n} onClick={() => applyBsPreset(n)}
                    className={cn('px-2.5 py-1 rounded text-xs font-medium transition-colors',
                      active ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200')}>
                    {n}M
                  </button>
                );
              })}
              <span className="text-gray-700 text-xs">|</span>
              <label className="text-xs text-gray-500">From</label>
              <input type="month" value={bsRange.start}
                onChange={e => setBsRange(r => ({ ...r, start: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-violet-500" />
              <label className="text-xs text-gray-500">To</label>
              <input type="month" value={bsRange.end}
                onChange={e => setBsRange(r => ({ ...r, end: e.target.value }))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-violet-500" />
              <span className="text-gray-700 text-xs">|</span>
              <button
                onClick={() => exportBsPdf({
                  monthCols: bsMonthCols,
                  sources: bsSources,
                  data: bsData,
                  fmtSource,
                })}
                title="Export to PDF"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors">
                <Download className="w-3 h-3" />PDF
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <StickyScrollX>
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-2.5 font-medium sticky left-0 bg-gray-900 z-10 min-w-[280px]">Item</th>
                  {bsMonthCols.map(mo => (
                    <th key={mo} className="text-right px-4 py-2.5 font-medium min-w-[130px] whitespace-nowrap">
                      {fmtMonth(mo)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* ── ASSETS ── */}
                <tr className="bg-blue-950/30 border-b border-blue-900/40">
                  <td className="px-5 py-2 sticky left-0 bg-blue-950/30 z-10" colSpan={bsMonthCols.length + 1}>
                    <span className="text-blue-400 text-xs font-bold uppercase tracking-widest">Assets</span>
                  </td>
                </tr>

                {/* Cash rows per source */}
                {bsSources.map(src => (
                  <tr key={src} className="border-b border-gray-800/60 hover:bg-gray-800/20">
                    <td className="px-5 py-2.5 sticky left-0 bg-gray-900 z-10">
                      <div className="flex items-center gap-2 pl-3">
                        <span className="inline-block w-2 h-2 rounded-sm shrink-0 bg-blue-500/60" />
                        <span className="text-gray-300 text-xs font-medium">{fmtSource(src)}</span>
                      </div>
                    </td>
                    {bsData.map(row => (
                      <td key={row.mo} className="px-4 py-2.5 text-right tabular-nums font-mono text-xs">
                        {row.cashBySrc[src] == null
                          ? <span className="text-gray-700">—</span>
                          : <span className={row.cashBySrc[src]! < 0 ? 'text-red-400' : 'text-blue-300'}>
                              {row.cashBySrc[src]! < 0 ? `($${fmt(Math.abs(row.cashBySrc[src]!))})` : `$${fmt(row.cashBySrc[src]!)}`}
                            </span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Total Assets */}
                <tr className="border-b-2 border-gray-700 bg-blue-950/20">
                  <td className="px-5 py-3 font-semibold text-blue-300 text-xs sticky left-0 bg-blue-950/20 z-10"
                    style={{ fontFamily: 'var(--font-heading)' }}>Total Assets</td>
                  {bsData.map(row => (
                    <td key={row.mo} className="px-4 py-3 text-right tabular-nums font-mono text-xs font-semibold">
                      {row.totalCash == null
                        ? <span className="text-gray-600">—</span>
                        : <span className={row.totalCash < 0 ? 'text-red-300' : 'text-blue-300'}>
                            {row.totalCash < 0 ? `($${fmt(Math.abs(row.totalCash))})` : `$${fmt(row.totalCash)}`}
                          </span>
                      }
                    </td>
                  ))}
                </tr>

                {/* Spacer */}
                <tr className="h-2 bg-gray-950"><td colSpan={bsMonthCols.length + 1} /></tr>

                {/* ── EQUITY ── */}
                <tr className="bg-violet-950/30 border-b border-violet-900/40">
                  <td className="px-5 py-2 sticky left-0 bg-violet-950/30 z-10" colSpan={bsMonthCols.length + 1}>
                    <span className="text-violet-400 text-xs font-bold uppercase tracking-widest">Equity</span>
                  </td>
                </tr>

                {/* Retained Earnings */}
                <tr className="border-b border-gray-800/60 hover:bg-gray-800/20">
                  <td className="px-5 py-2.5 sticky left-0 bg-gray-900 z-10">
                    <div className="flex items-center gap-2 pl-3">
                      <span className="inline-block w-2 h-2 rounded-sm shrink-0 bg-violet-500/60" />
                      <span className="text-gray-300 text-xs font-medium">Retained Earnings</span>
                    </div>
                  </td>
                  {bsData.map(row => (
                    <td key={row.mo} className="px-4 py-2.5 text-right tabular-nums font-mono text-xs">
                      <span className={row.retainedEarnings < 0 ? 'text-red-400' : 'text-violet-300'}>
                        {row.retainedEarnings < 0
                          ? `($${fmt(Math.abs(row.retainedEarnings))})`
                          : `$${fmt(row.retainedEarnings)}`}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Total Equity */}
                <tr className="border-b-2 border-gray-700 bg-violet-950/20">
                  <td className="px-5 py-3 font-semibold text-violet-300 text-xs sticky left-0 bg-violet-950/20 z-10"
                    style={{ fontFamily: 'var(--font-heading)' }}>Total Equity</td>
                  {bsData.map(row => (
                    <td key={row.mo} className="px-4 py-3 text-right tabular-nums font-mono text-xs font-semibold">
                      <span className={row.retainedEarnings < 0 ? 'text-red-300' : 'text-violet-300'}>
                        {row.retainedEarnings < 0
                          ? `($${fmt(Math.abs(row.retainedEarnings))})`
                          : `$${fmt(row.retainedEarnings)}`}
                      </span>
                    </td>
                  ))}
                </tr>

              </tbody>
            </table>
          </StickyScrollX>
        </CardContent>
      </Card>
    </div>
  );
}
