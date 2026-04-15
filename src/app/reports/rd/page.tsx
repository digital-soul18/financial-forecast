'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CATEGORIES } from '@/lib/categoryConstants';
import { getCategoryColor } from '@/lib/categoryColors';
import { Download, FlaskConical, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function fmt(n: number) {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  subcategory: string;
  rdEligible: boolean;
  rdPercentage: number | null;
  transactionDetails: string | null;
  merchantName: string | null;
  notes: string | null;
  source: string;
}

interface RdConfig {
  category: string;
  subcategory: string;
  rdPercent: number;
}

function buildRdBreakdown(transactions: Transaction[], configs: RdConfig[]) {
  function getRdPct(tx: Transaction) {
    if (tx.rdPercentage != null) return tx.rdPercentage;
    return configs.find(c => c.category === tx.category && c.subcategory === tx.subcategory)?.rdPercent ?? 0;
  }

  // category → subcategory → txns
  const map: Record<string, Record<string, Transaction[]>> = {};
  for (const tx of transactions) {
    if (tx.amount >= 0) continue; // expenses only
    const cat = tx.category ?? 'other_expenses';
    const sub = tx.subcategory ?? 'miscellaneous';
    if (!map[cat]) map[cat] = {};
    if (!map[cat][sub]) map[cat][sub] = [];
    map[cat][sub].push(tx);
  }

  return CATEGORIES.map(catDef => {
    const subcats = catDef.subcategories.map(subDef => {
      const txns = (map[catDef.slug]?.[subDef.slug] ?? []).sort((a, b) => b.date.localeCompare(a.date));
      const totalSpend = txns.reduce((s, t) => s + Math.abs(t.amount), 0);
      const rdAmount = txns.reduce((s, t) => s + Math.abs(t.amount) * getRdPct(t) / 100, 0);
      const avgRdPct = totalSpend > 0 ? rdAmount / totalSpend * 100 : 0;
      return { slug: subDef.slug, label: subDef.label, txns, totalSpend, rdAmount, avgRdPct };
    }).filter(s => s.txns.length > 0);

    const totalSpend = subcats.reduce((s, r) => s + r.totalSpend, 0);
    const rdAmount = subcats.reduce((s, r) => s + r.rdAmount, 0);
    const avgRdPct = totalSpend > 0 ? rdAmount / totalSpend * 100 : 0;
    const count = subcats.reduce((s, r) => s + r.txns.length, 0);
    return { slug: catDef.slug, label: catDef.label, subcats, totalSpend, rdAmount, avgRdPct, count };
  }).filter(c => c.count > 0);
}

export default function RdReportPage() {
  const router = useRouter();
  const { data: txData } = useSWR('/api/transactions?limit=10000&rdEligible=true', fetcher);
  const { data: rdConfigs, mutate: mutateConfigs } = useSWR('/api/rd-config', fetcher);
  const [year, setYear] = useState('2026');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drilled, setDrilled] = useState<Record<string, boolean>>({});
  // editingRd key: "cat:{slug}" or "sub:{catSlug}-{subSlug}"
  const [editingRd, setEditingRd] = useState<{ key: string; value: string } | null>(null);

  const allTxns: Transaction[] = (txData?.transactions ?? []).filter((t: Transaction) => t.rdEligible);
  const configs: RdConfig[] = rdConfigs ?? [];

  // Filter by Australian FY (Jul–Jun)
  const filtered = allTxns.filter(t => {
    const d = new Date(t.date);
    const fy = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
    return String(fy) === year;
  });

  const breakdown = buildRdBreakdown(filtered, configs);
  const grandRd = breakdown.reduce((s, c) => s + c.rdAmount, 0);
  const grandSpend = breakdown.reduce((s, c) => s + c.totalSpend, 0);
  const grandCount = breakdown.reduce((s, c) => s + c.count, 0);

  const toggle = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }));
  const toggleDrill = (key: string) => setDrilled(p => ({ ...p, [key]: !p[key] }));

  function startEditRd(key: string, currentPct: number, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingRd({ key, value: String(Math.round(currentPct)) });
  }

  async function saveRdEdit(catSlug: string, subSlug?: string) {
    if (!editingRd) return;
    const pct = Math.min(100, Math.max(0, parseFloat(editingRd.value) || 0));

    let updates: Array<{ category: string; subcategory: string; rdPercent: number }>;
    if (subSlug) {
      updates = [{ category: catSlug, subcategory: subSlug, rdPercent: pct }];
    } else {
      // Propagate to every subcategory in this category
      const catDef = CATEGORIES.find(c => c.slug === catSlug);
      updates = (catDef?.subcategories ?? []).map(s => ({
        category: catSlug, subcategory: s.slug, rdPercent: pct,
      }));
    }

    setEditingRd(null);
    await fetch('/api/rd-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    mutateConfigs();
  }

  const exportCsv = () => {
    const lines = ['Category,Subcategory,Date,Description,Total Spend,R&D %,R&D Amount'];
    for (const cat of breakdown) {
      for (const sub of cat.subcats) {
        for (const tx of sub.txns) {
          const rdPct = tx.rdPercentage ?? configs.find(c => c.category === tx.category && c.subcategory === tx.subcategory)?.rdPercent ?? 0;
          const rdAmt = Math.abs(tx.amount) * rdPct / 100;
          const desc = (tx.merchantName || tx.transactionDetails || '').replace(/"/g, '""');
          lines.push(`"${cat.label}","${sub.label}","${tx.date.slice(0, 10)}","${desc}",${Math.abs(tx.amount).toFixed(2)},${rdPct}%,${rdAmt.toFixed(2)}`);
        }
      }
    }
    lines.push(`"TOTAL","","","",${grandSpend.toFixed(2)},,${grandRd.toFixed(2)}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `rd-report-fy${year}.csv`,
    });
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-violet-400" />
          <h1 className="text-xl font-semibold text-gray-100">R&amp;D Tax Incentive Report</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-md px-3 py-1.5"
          >
            {['2024', '2025', '2026', '2027'].map(y => <option key={y} value={y}>FY{y}</option>)}
          </select>
          <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 gap-2" onClick={exportCsv}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-400 font-normal">Total R&amp;D Claimable</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-violet-400">${fmt(grandRd)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-400 font-normal">Total Flagged Spend</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-gray-200">${fmt(grandSpend)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-400 font-normal">Avg R&amp;D %</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-amber-400">
              {grandSpend > 0 ? Math.round(grandRd / grandSpend * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3 pt-5 px-5 flex-row items-center justify-between">
          <CardTitle className="text-sm text-gray-300">R&amp;D Expenditure by Category — FY{year}</CardTitle>
          <span className="text-xs text-gray-500">{grandCount} transactions</span>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-2.5 font-medium">Category / Subcategory</th>
                <th className="text-right px-4 py-2.5 font-medium w-24">Txns</th>
                <th className="text-right px-4 py-2.5 font-medium w-36">Total Spend</th>
                <th className="text-right px-4 py-2.5 font-medium w-20">R&amp;D %</th>
                <th className="text-right px-5 py-2.5 font-medium w-36">R&amp;D Amount</th>
                <th className="text-right px-5 py-2.5 font-medium w-28">% of R&amp;D</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-600 text-sm">
                    No R&amp;D eligible transactions for FY{year}. Flag transactions on the Transactions page.
                  </td>
                </tr>
              ) : (
                <>
                  {breakdown.map(cat => {
                    const isOpen = !collapsed[cat.slug];
                    const pct = grandRd > 0 ? cat.rdAmount / grandRd * 100 : 0;

                    return [
                      /* ── Category row ── */
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
                            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: getCategoryColor(cat.slug) }} />
                            <span className="font-semibold text-gray-100" style={{ fontFamily: 'var(--font-heading)' }}>
                              {cat.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 tabular-nums">{cat.count}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-red-400">
                          -${fmt(cat.totalSpend)}
                        </td>
                        <td
                          className="px-4 py-3 text-right tabular-nums"
                          onClick={e => editingRd?.key === `cat:${cat.slug}` ? e.stopPropagation() : startEditRd(`cat:${cat.slug}`, cat.avgRdPct, e)}
                        >
                          {editingRd?.key === `cat:${cat.slug}` ? (
                            <input
                              type="number" min="0" max="100"
                              value={editingRd.value}
                              autoFocus
                              onChange={e => setEditingRd(p => p ? { ...p, value: e.target.value } : null)}
                              onBlur={() => saveRdEdit(cat.slug)}
                              onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') saveRdEdit(cat.slug); if (e.key === 'Escape') setEditingRd(null); }}
                              onClick={e => e.stopPropagation()}
                              className="w-16 bg-gray-800 border border-violet-500 rounded px-1.5 py-0.5 text-xs text-amber-400 font-mono tabular-nums text-right focus:outline-none focus:border-violet-400"
                            />
                          ) : (
                            <span className="text-amber-400 font-medium cursor-pointer border-b border-dashed border-amber-700 hover:border-amber-400 transition-colors" title="Click to edit R&D % for all subcategories">
                              {cat.avgRdPct.toFixed(0)}%
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums font-semibold text-violet-400">
                          ${fmt(cat.rdAmount)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <span className="text-gray-400 text-xs">{pct.toFixed(1)}%</span>
                            <span
                              className="inline-block h-1.5 rounded-full"
                              style={{ width: `${Math.max(2, pct)}px`, background: getCategoryColor(cat.slug), maxWidth: '48px' }}
                            />
                          </span>
                        </td>
                      </tr>,

                      /* ── Subcategory rows ── */
                      ...(isOpen ? cat.subcats.flatMap(sub => {
                        const drillKey = `${cat.slug}-${sub.slug}`;
                        const isDrilled = !!drilled[drillKey];
                        const subPct = grandRd > 0 ? sub.rdAmount / grandRd * 100 : 0;

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
                                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 opacity-60" style={{ background: getCategoryColor(cat.slug) }} />
                                <span className="text-gray-400">{sub.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right text-gray-500 tabular-nums text-xs">{sub.txns.length}</td>
                            <td className="px-4 py-2 text-right font-mono tabular-nums text-sm text-red-400/80">
                              -${fmt(sub.totalSpend)}
                            </td>
                            <td
                              className="px-4 py-2 text-right tabular-nums text-xs"
                              onClick={e => editingRd?.key === drillKey ? e.stopPropagation() : startEditRd(drillKey, sub.avgRdPct, e)}
                            >
                              {editingRd?.key === drillKey ? (
                                <input
                                  type="number" min="0" max="100"
                                  value={editingRd.value}
                                  autoFocus
                                  onChange={e => setEditingRd(p => p ? { ...p, value: e.target.value } : null)}
                                  onBlur={() => saveRdEdit(cat.slug, sub.slug)}
                                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') saveRdEdit(cat.slug, sub.slug); if (e.key === 'Escape') setEditingRd(null); }}
                                  onClick={e => e.stopPropagation()}
                                  className="w-16 bg-gray-800 border border-violet-500 rounded px-1.5 py-0.5 text-xs text-amber-400 font-mono tabular-nums text-right focus:outline-none focus:border-violet-400"
                                />
                              ) : (
                                <span className="text-amber-400/80 cursor-pointer border-b border-dashed border-amber-800 hover:border-amber-500 transition-colors" title="Click to edit R&D %">
                                  {sub.avgRdPct.toFixed(0)}%
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-2 text-right font-mono tabular-nums text-sm text-violet-400/80">
                              ${fmt(sub.rdAmount)}
                            </td>
                            <td className="px-5 py-2 text-right tabular-nums text-xs text-gray-500">
                              {subPct.toFixed(1)}%
                            </td>
                          </tr>,

                          /* Transaction rows */
                          ...(isDrilled ? sub.txns.map(tx => {
                            const rdPct = tx.rdPercentage ?? configs.find(c => c.category === tx.category && c.subcategory === tx.subcategory)?.rdPercent ?? 0;
                            const rdAmt = Math.abs(tx.amount) * rdPct / 100;
                            const desc = tx.merchantName || tx.transactionDetails || '—';
                            return (
                              <tr key={tx.id} className="border-b border-gray-800/30 bg-gray-950/60 hover:bg-gray-900/60 group">
                                <td className="px-5 py-1.5">
                                  <div className="flex items-center gap-2 pl-14 min-w-0">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-gray-500 truncate text-xs">{desc}</div>
                                      {tx.notes && (
                                        <div className="text-amber-300/80 text-[10px] italic truncate mt-0.5" title={tx.notes}>
                                          {tx.notes}
                                        </div>
                                      )}
                                    </div>
                                    <span className={cn(
                                      'shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide',
                                      tx.source === 'nab' ? 'bg-blue-900/50 text-blue-400' : 'bg-violet-900/50 text-violet-400',
                                    )}>
                                      {tx.source}
                                    </span>
                                    <button
                                      title="View & edit in Transactions"
                                      onClick={e => { e.stopPropagation(); router.push(`/transactions?highlight=${tx.id}`); }}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded hover:bg-violet-900/50 text-violet-400 hover:text-violet-300"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-1.5 text-right text-gray-600 tabular-nums text-xs">
                                  {tx.date.slice(0, 10)}
                                </td>
                                <td className="px-4 py-1.5 text-right font-mono tabular-nums text-xs text-red-300/70">
                                  -${fmt(Math.abs(tx.amount))}
                                </td>
                                <td className="px-4 py-1.5 text-right tabular-nums text-xs text-amber-400/70">
                                  {rdPct}%
                                </td>
                                <td className="px-5 py-1.5 text-right font-mono tabular-nums text-xs text-violet-400/70">
                                  ${fmt(rdAmt)}
                                </td>
                                <td />
                              </tr>
                            );
                          }) : []),
                        ];
                      }) : []),
                    ];
                  })}

                  {/* Grand total row */}
                  <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                    <td className="px-5 py-3 font-semibold text-gray-200" style={{ fontFamily: 'var(--font-heading)' }}>
                      Total
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{grandCount}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-red-400">
                      -${fmt(grandSpend)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-400">
                      {grandSpend > 0 ? Math.round(grandRd / grandSpend * 100) : 0}%
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums font-bold text-violet-300 text-base">
                      ${fmt(grandRd)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400 text-xs">100%</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
