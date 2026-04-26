'use client';

import useSWR from 'swr';
import { useState, useRef, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, ReferenceLine, Cell,
} from 'recharts';
import { CATEGORIES as ALL_CATEGORIES } from '@/lib/categoryConstants';

// Internal transfers are neither revenue nor expense — exclude from forecast entirely
const CATEGORIES = ALL_CATEGORIES.filter(c => c.slug !== 'internal_transfers');
import { getCategoryColor } from '@/lib/categoryColors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Plus, Trash2, AlignJustify, X, Save, FolderOpen, RotateCcw, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ── Month helpers ──────────────────────────────────────────────────────────────

function toYM(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const date = new Date(y, m - 1 + n, 1);
  return toYM(date);
}

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} '${String(y).slice(2)}`;
}

function fmt(n: number): string {
  return n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCell(amount: number): string {
  if (amount === 0) return '—';
  return `$${fmt(Math.abs(amount))}`;
}

// ── Interfaces ─────────────────────────────────────────────────────────────────

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

interface ForecastOverride {
  id: string;
  category: string;
  subcategory: string;
  customLabel: string | null;
  customCategoryLabel: string | null;
  month: string;
  amount: number;
}

interface CustomCatDef {
  label: string;
  isExpense: boolean;
  subcats: { slug: string; label: string }[];
}

// ── Weighted moving average projection ────────────────────────────────────────

function computeProjected(
  cat: string,
  sub: string,
  pastMonths: string[],
  actualMap: Record<string, Record<string, Record<string, number>>>
): number {
  if (pastMonths.length === 0) return 0;
  const total = pastMonths.reduce((sum, mo) => sum + (actualMap[cat]?.[sub]?.[mo] ?? 0), 0);
  return total / pastMonths.length;
}

// ── StickyScrollX ──────────────────────────────────────────────────────────────

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

    const updateWidth = () => { phantom.style.width = inner.scrollWidth + 'px'; };
    const ro = new ResizeObserver(updateWidth);
    ro.observe(inner);
    updateWidth();

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
      <div
        ref={outerRef}
        style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        <div ref={innerRef}>{children}</div>
      </div>
      <div
        ref={mirrorRef}
        className={[
          'overflow-x-auto sticky bottom-0 z-20',
          'bg-gray-800 border-t border-gray-700',
          '[scrollbar-color:#6b7280_#1f2937]',
          '[&::-webkit-scrollbar]:h-3',
          '[&::-webkit-scrollbar-track]:bg-gray-800',
          '[&::-webkit-scrollbar-thumb]:bg-gray-500',
          '[&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb:hover]:bg-gray-400',
        ].join(' ')}
        style={{ height: 16 }}
      >
        <div style={{ height: 1 }} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const router = useRouter();

  // Data
  const { data: txData } = useSWR('/api/transactions?limit=10000', fetcher);
  const { data: overrideData, mutate: mutateOverrides } = useSWR('/api/forecast-overrides', fetcher);
  const { data: scenarioData, mutate: mutateScenarios } = useSWR('/api/forecast-scenarios', fetcher);

  const transactions: Transaction[] = txData?.transactions ?? [];
  const overrides: ForecastOverride[] = overrideData ?? [];
  const scenarios: Array<{ id: string; name: string; createdAt: string }> = scenarioData ?? [];

  // Month ranges
  const currentMonth = toYM(new Date());
  const pastMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    pastMonths.push(addMonths(currentMonth, -i));
  }
  // Completed months = past months excluding the current (in-progress) month
  // Used for projection averages so a half-filled month doesn't drag numbers down
  const completedMonths = pastMonths.filter(m => m < currentMonth);
  const futureMonths: string[] = [];
  for (let i = 1; i <= 12; i++) {
    futureMonths.push(addMonths(currentMonth, i));
  }
  const allMonths = [...pastMonths, ...futureMonths];

  // Table state
  const [catOpen, setCatOpen] = useState<Record<string, boolean>>({});
  const [subDrilled, setSubDrilled] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ cat: string; sub: string; month: string; value: string } | null>(null);
  const [bulkEdit, setBulkEdit] = useState<{ cat: string; sub: string; value: string } | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newSubcatLabel, setNewSubcatLabel] = useState('');

  // Custom category state
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatIsExpense, setNewCatIsExpense] = useState(true);

  // Scenario state
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [creatingScenario, setCreatingScenario] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [scenarioSaving, setScenarioSaving] = useState(false);
  const [loadingScenario, setLoadingScenario] = useState(false);
  // Snapshot of overrides captured just before loading a scenario, so we can restore Default
  const preScenarioSnapshot = useRef<ForecastOverride[] | null>(null);


  // Build actuals map: cat → sub → month → sum
  const actualMap: Record<string, Record<string, Record<string, number>>> = {};
  for (const t of transactions) {
    const mo = t.date.slice(0, 7);
    const cat = t.category ?? 'other_expenses';
    const sub = t.subcategory ?? 'miscellaneous';
    if (!actualMap[cat]) actualMap[cat] = {};
    if (!actualMap[cat][sub]) actualMap[cat][sub] = {};
    actualMap[cat][sub][mo] = (actualMap[cat][sub][mo] ?? 0) + t.amount;
  }

  // Build override map: `${cat}__${sub}__${month}` → amount
  const overrideMap: Record<string, number> = {};
  for (const o of overrides) {
    overrideMap[`${o.category}__${o.subcategory}__${o.month}`] = o.amount;
  }

  // Build custom subcat defs for EXISTING categories: catSlug → [{slug, label}]
  // (excludes overrides that belong to fully custom categories)
  const customSubcatDefs: Record<string, Array<{ slug: string; label: string }>> = {};
  for (const o of overrides) {
    if (o.customLabel && !o.customCategoryLabel) {
      if (!customSubcatDefs[o.category]) customSubcatDefs[o.category] = [];
      const existing = customSubcatDefs[o.category].find(c => c.slug === o.subcategory);
      if (!existing) {
        customSubcatDefs[o.category].push({ slug: o.subcategory, label: o.customLabel });
      }
    }
  }

  // Build custom category defs: fully forecast-only categories added by the user
  // catSlug encodes type: contains "_exp_" = expense, "_rev_" = revenue
  const customCatDefs: Record<string, CustomCatDef> = {};
  for (const o of overrides) {
    if (o.customCategoryLabel) {
      if (!customCatDefs[o.category]) {
        customCatDefs[o.category] = {
          label: o.customCategoryLabel,
          isExpense: !o.category.includes('_rev_'),
          subcats: [],
        };
      }
      if (o.customLabel) {
        const existing = customCatDefs[o.category].subcats.find(s => s.slug === o.subcategory);
        if (!existing) {
          customCatDefs[o.category].subcats.push({ slug: o.subcategory, label: o.customLabel });
        }
      }
    }
  }

  // ── Save functions ───────────────────────────────────────────────────────────

  // Optimistic helper: merges new override entries into the local SWR cache
  function applyOptimisticOverrides(newEntries: Array<{ category: string; subcategory: string; month: string; amount: number; customLabel?: string | null; customCategoryLabel?: string | null }>) {
    mutateOverrides(
      (current: ForecastOverride[] = []) => {
        // For existing overrides: merge the new fields in (preserving customLabel / customCategoryLabel
        // so custom categories don't vanish during optimistic updates).
        // For brand-new entries that have no existing override: append them.
        const updated = current.map(o => {
          const match = newEntries.find(
            e => e.category === o.category && e.subcategory === o.subcategory && e.month === o.month,
          );
          return match ? { ...o, ...match } : o; // spread match last so new amount wins
        });
        const brandNew = newEntries.filter(
          e => !current.some(o => o.category === e.category && o.subcategory === e.subcategory && o.month === e.month),
        );
        return [
          ...updated,
          ...brandNew.map(e => ({ id: 'optimistic', customLabel: null, customCategoryLabel: null, ...e })),
        ];
      },
      { revalidate: false },
    );
  }

  async function saveCell(cat: string, sub: string, month: string, rawValue: string, isExpense: boolean) {
    const val = parseFloat(rawValue);
    // Close editor immediately regardless
    setEditingCell(null);
    if (isNaN(val)) return;
    const amount = isExpense ? -Math.abs(val) : Math.abs(val);
    // Optimistic update — cell reflects new value instantly
    applyOptimisticOverrides([{ category: cat, subcategory: sub, month, amount }]);
    try {
      await fetch('/api/forecast-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ category: cat, subcategory: sub, month, amount }] }),
      });
    } finally {
      mutateOverrides(); // re-sync with server (fire-and-forget)
    }
  }

  async function saveAllFuture(cat: string, sub: string, rawValue: string, isExpense: boolean) {
    const val = parseFloat(rawValue);
    setBulkEdit(null);
    if (isNaN(val)) return;
    const amount = isExpense ? -Math.abs(val) : Math.abs(val);
    const updates = futureMonths.map(month => ({ category: cat, subcategory: sub, month, amount }));
    applyOptimisticOverrides(updates);
    try {
      await fetch('/api/forecast-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
    } finally {
      mutateOverrides();
    }
  }

  async function removeOverride(cat: string, sub: string, month: string) {
    // Optimistic remove
    mutateOverrides(
      (current: ForecastOverride[] = []) =>
        current.filter(o => !(o.category === cat && o.subcategory === sub && o.month === month)),
      { revalidate: false },
    );
    try {
      await fetch('/api/forecast-overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, subcategory: sub, month }),
      });
    } finally {
      mutateOverrides();
    }
  }

  async function removeAllOverridesForSubcat(cat: string, sub: string) {
    await Promise.all(
      [...pastMonths, ...futureMonths].map(month =>
        fetch('/api/forecast-overrides', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: cat, subcategory: sub, month }),
        })
      )
    );
    await mutateOverrides();
  }

  async function addCustomSubcat(catSlug: string, label: string, catLabel?: string) {
    if (!label.trim()) return;
    const slug = `custom_${label.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const updates = futureMonths.map(month => ({
      category: catSlug,
      subcategory: slug,
      customLabel: label,
      customCategoryLabel: catLabel ?? null,
      month,
      amount: 0,
    }));
    applyOptimisticOverrides(updates);
    await fetch('/api/forecast-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    await mutateOverrides();
    setAddingTo(null);
    setNewSubcatLabel('');
  }

  async function addCustomCategory(label: string, isExpense: boolean) {
    if (!label.trim()) return;
    const typeKey = isExpense ? 'exp' : 'rev';
    const catSlug = `custom_${typeKey}_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
    const subcatSlug = `custom_general_${Date.now()}`;
    const subcatLabel = 'General';
    const updates = futureMonths.map(month => ({
      category: catSlug,
      subcategory: subcatSlug,
      customLabel: subcatLabel,
      customCategoryLabel: label,
      month,
      amount: 0,
    }));
    applyOptimisticOverrides(updates);
    await fetch('/api/forecast-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    await mutateOverrides();
    setAddingCategory(false);
    setNewCatLabel('');
  }

  async function removeCustomCategory(catSlug: string) {
    mutateOverrides(
      (current: ForecastOverride[] = []) => current.filter(o => o.category !== catSlug),
      { revalidate: false },
    );
    await fetch('/api/forecast-overrides', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteCategory: catSlug }),
    });
    mutateOverrides();
  }

  // ── Scenario functions ───────────────────────────────────────────────────────

  async function switchScenario(id: string | null) {
    if (id === null) {
      // Restore the overrides that existed before any scenario was loaded
      const snapshot = preScenarioSnapshot.current ?? [];
      preScenarioSnapshot.current = null;
      setActiveScenarioId(null);

      // Optimistically show the restored data immediately
      mutateOverrides(snapshot, { revalidate: false });

      // Write back to DB: clear current (scenario) overrides, re-insert the snapshot
      await fetch('/api/forecast-overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
      if (snapshot.length > 0) {
        await fetch('/api/forecast-overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: snapshot }),
        });
      }
      // Re-fetch to confirm DB state matches
      await mutateOverrides();
      return;
    }

    // Save the current overrides before stomping them with the scenario snapshot
    preScenarioSnapshot.current = overrides;

    setLoadingScenario(true);
    try {
      await fetch(`/api/forecast-scenarios/${id}`, { method: 'POST' });
      await mutateOverrides();
      setActiveScenarioId(id);
    } finally {
      setLoadingScenario(false);
    }
  }

  async function handleSave() {
    if (activeScenarioId) {
      // Update existing scenario snapshot in place
      setScenarioSaving(true);
      try {
        await fetch(`/api/forecast-scenarios/${activeScenarioId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot: overrides }),
        });
        await mutateScenarios();
      } finally {
        setScenarioSaving(false);
      }
    } else {
      // On Default — prompt for a name to create a new scenario
      setCreatingScenario(true);
    }
  }

  async function createScenario() {
    if (!newScenarioName.trim()) return;
    setScenarioSaving(true);
    try {
      const res = await fetch('/api/forecast-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newScenarioName.trim(), snapshot: overrides }),
      });
      const created = await res.json() as { id: string };
      await mutateScenarios();
      setActiveScenarioId(created.id);
      setCreatingScenario(false);
      setNewScenarioName('');
    } finally {
      setScenarioSaving(false);
    }
  }

  async function deleteCurrentScenario() {
    if (!activeScenarioId) return;
    if (!confirm('Delete this scenario? This cannot be undone.')) return;
    await fetch(`/api/forecast-scenarios/${activeScenarioId}`, { method: 'DELETE' });
    await mutateScenarios();
    // Switch back to Default, restoring pre-scenario overrides
    await switchScenario(null);
  }

  async function newForecast() {
    if (!confirm('Reset all forecast overrides to baseline projections (averages of past months)? This cannot be undone.')) return;
    // Clear all overrides
    mutateOverrides([], { revalidate: false });
    try {
      await fetch('/api/forecast-overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
    } finally {
      mutateOverrides();
    }
  }

  // ── Helper: get value for a cell ─────────────────────────────────────────────

  function getCellValue(cat: string, sub: string, month: string, isFuture: boolean): { value: number; isOverride: boolean; isProjected: boolean } {
    const key = `${cat}__${sub}__${month}`;
    if (overrideMap[key] !== undefined) {
      return { value: overrideMap[key], isOverride: true, isProjected: false };
    }
    if (isFuture) {
      const projected = computeProjected(cat, sub, completedMonths, actualMap);
      return { value: projected, isOverride: false, isProjected: true };
    }
    return { value: actualMap[cat]?.[sub]?.[month] ?? 0, isOverride: false, isProjected: false };
  }

  // ── Chart data ───────────────────────────────────────────────────────────────

  // Chart 1: Monthly Spend bars
  const chartMonths = allMonths;
  const chart1Data = chartMonths.map(month => {
    const isPast = month <= currentMonth;
    let monthTotal = 0;

    if (isPast) {
      for (const cat of CATEGORIES) {
        if (!cat.isExpense) continue;
        for (const sub of cat.subcategories) {
          monthTotal += Math.abs(actualMap[cat.slug]?.[sub.slug]?.[month] ?? 0);
        }
        for (const cs of customSubcatDefs[cat.slug] ?? []) {
          monthTotal += Math.abs(actualMap[cat.slug]?.[cs.slug]?.[month] ?? 0);
        }
      }
      return { month, actual: Math.round(monthTotal), projected: null };
    } else {
      for (const cat of CATEGORIES) {
        if (!cat.isExpense) continue;
        for (const sub of cat.subcategories) {
          const { value } = getCellValue(cat.slug, sub.slug, month, true);
          monthTotal += Math.abs(value);
        }
        for (const cs of customSubcatDefs[cat.slug] ?? []) {
          const { value } = getCellValue(cat.slug, cs.slug, month, true);
          monthTotal += Math.abs(value);
        }
      }
      // Include custom forecast-only expense categories
      for (const [catSlug, catDef] of Object.entries(customCatDefs)) {
        if (!catDef.isExpense) continue;
        for (const sub of catDef.subcats) {
          const { value } = getCellValue(catSlug, sub.slug, month, true);
          monthTotal += Math.abs(value);
        }
      }
      return { month, actual: null, projected: Math.round(monthTotal) };
    }
  });

  // ── Burndown chart ───────────────────────────────────────────────────────────
  // Current balance: most recent transaction that has a balance field
  const txWithBalance = [...transactions]
    .filter(t => t.balance != null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const currentBalance = txWithBalance[0]?.balance ?? null;

  // Monthly closing balances for past months: last balance reading in each month
  const monthlyClosingBalance: Record<string, number | null> = {};
  for (const mo of pastMonths) {
    const moTx = txWithBalance.filter(t => t.date.slice(0, 7) === mo);
    monthlyClosingBalance[mo] = moTx[0]?.balance ?? null; // already sorted desc
  }

  // Monthly net spend for future months: expenses − revenue (negative = net outflow)
  function getMonthlyNet(month: string, isFuture: boolean): number {
    let net = 0;
    for (const cat of CATEGORIES) {
      for (const sub of cat.subcategories) {
        net += getCellValue(cat.slug, sub.slug, month, isFuture).value;
      }
      for (const cs of customSubcatDefs[cat.slug] ?? []) {
        net += getCellValue(cat.slug, cs.slug, month, isFuture).value;
      }
    }
    for (const [catSlug, catDef] of Object.entries(customCatDefs)) {
      for (const sub of catDef.subcats) {
        net += getCellValue(catSlug, sub.slug, month, isFuture).value;
      }
    }
    return net; // negative = net outflow (expenses > revenue)
  }

  // Build burndown line: starts at currentBalance, descends month by month
  let runningBalance = currentBalance ?? 0;
  let runwayMonth: string | null = null;

  const chart2Data = (() => {
    const rows: Array<{
      month: string;
      actualBalance: number | null;
      projectedBalance: number | null;
      zeroLine: number;
    }> = [];

    // Past months: actual closing balance
    for (const mo of pastMonths) {
      const bal = monthlyClosingBalance[mo];
      rows.push({ month: mo, actualBalance: bal != null ? Math.round(bal) : null, projectedBalance: null, zeroLine: 0 });
      if (bal != null) runningBalance = bal; // keep track of latest known balance
    }

    // Future months: project forward from most recent known balance
    for (const mo of futureMonths) {
      const net = getMonthlyNet(mo, true); // negative for net outflow
      runningBalance += net; // net is negative, so balance drops
      const projected = Math.round(runningBalance);
      if (runwayMonth === null && projected <= 0) runwayMonth = mo;
      rows.push({ month: mo, actualBalance: null, projectedBalance: projected, zeroLine: 0 });
    }

    return rows;
  })();

  // Runway in months from now
  const runwayMonths = runwayMonth
    ? futureMonths.indexOf(runwayMonth) + 1
    : null;

  // ── KPI totals ───────────────────────────────────────────────────────────────

  const totalPastExpenses = pastMonths.reduce((acc, month) => {
    let s = 0;
    for (const cat of CATEGORIES) {
      if (!cat.isExpense) continue;
      for (const sub of cat.subcategories) {
        s += Math.abs(actualMap[cat.slug]?.[sub.slug]?.[month] ?? 0);
      }
    }
    return acc + s;
  }, 0);

  const avgMonthlyExpense = totalPastExpenses / Math.max(pastMonths.length, 1);

  const totalProjectedExpenses = futureMonths.reduce((acc, month) => {
    let s = 0;
    for (const cat of CATEGORIES) {
      if (!cat.isExpense) continue;
      for (const sub of cat.subcategories) {
        const { value } = getCellValue(cat.slug, sub.slug, month, true);
        s += Math.abs(value);
      }
      const customs = customSubcatDefs[cat.slug] ?? [];
      for (const cs of customs) {
        const { value } = getCellValue(cat.slug, cs.slug, month, true);
        s += Math.abs(value);
      }
    }
    for (const [catSlug, catDef] of Object.entries(customCatDefs)) {
      if (!catDef.isExpense) continue;
      for (const sub of catDef.subcats) {
        const { value } = getCellValue(catSlug, sub.slug, month, true);
        s += Math.abs(value);
      }
    }
    return acc + s;
  }, 0);

  // ── Grand total per month ────────────────────────────────────────────────────

  function getGrandTotal(month: string, isFuture: boolean): number {
    let s = 0;
    for (const cat of CATEGORIES) {
      for (const sub of cat.subcategories) {
        s += getCellValue(cat.slug, sub.slug, month, isFuture).value;
      }
      const customs = customSubcatDefs[cat.slug] ?? [];
      for (const cs of customs) {
        s += getCellValue(cat.slug, cs.slug, month, isFuture).value;
      }
    }
    for (const [catSlug, catDef] of Object.entries(customCatDefs)) {
      for (const sub of catDef.subcats) {
        s += getCellValue(catSlug, sub.slug, month, isFuture).value;
      }
    }
    return s;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const firstFutureIdx = pastMonths.length; // index in allMonths where future starts

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Financial Forecast</h1>
        <p className="text-xs text-gray-400">Click any future cell to override · Use ≡ for bulk row edit</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-400 font-normal">Current Balance</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {currentBalance != null
              ? <p className="text-2xl font-semibold text-emerald-400">${fmt(Math.round(currentBalance))}</p>
              : <p className="text-2xl font-semibold text-gray-600">No data</p>}
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-400 font-normal">Avg Monthly Burn</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-red-400">${fmt(Math.round(avgMonthlyExpense))}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-400 font-normal">Projected Expenses (12mo)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-violet-400">${fmt(Math.round(totalProjectedExpenses))}</p>
          </CardContent>
        </Card>
        <Card className={cn('border', runwayMonths == null ? 'bg-emerald-950/30 border-emerald-800' : runwayMonths <= 3 ? 'bg-red-950/40 border-red-800' : runwayMonths <= 6 ? 'bg-amber-950/30 border-amber-800' : 'bg-gray-900 border-gray-800')}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-gray-400 font-normal">Runway</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={cn('text-2xl font-semibold', runwayMonths == null ? 'text-emerald-400' : runwayMonths <= 3 ? 'text-red-400' : runwayMonths <= 6 ? 'text-amber-400' : 'text-gray-200')}>
              {currentBalance == null ? 'N/A' : runwayMonths == null ? '12m+ ✓' : `${runwayMonths}mo`}
            </p>
            {runwayMonth && <p className="text-xs text-gray-500 mt-0.5">Zero by {fmtMonth(runwayMonth)}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Chart 1: Monthly Spend */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-300">Monthly Spend — bars = actual (red) / projected (violet) · line = cumulative</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chart1Data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={fmtMonth} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v) => [`$${typeof v === 'number' ? fmt(v) : v}`, '']}
                labelFormatter={(label: unknown) => typeof label === 'string' ? fmtMonth(label) : String(label)}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }}
              />
              <ReferenceLine x={currentMonth} stroke="#6b7280" strokeDasharray="4 2" label={{ value: 'Today', fill: '#9ca3af', fontSize: 10 }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              <Bar dataKey="actual" name="Actual" fill="#f87171" radius={[2, 2, 0, 0]}>
                {chart1Data.map((_, i) => (
                  <Cell key={i} fill="#f87171" />
                ))}
              </Bar>
              <Bar dataKey="projected" name="Projected" fill="#a78bfa" fillOpacity={0.6} radius={[2, 2, 0, 0]}>
                {chart1Data.map((_, i) => (
                  <Cell key={i} fill="#a78bfa" fillOpacity={0.6} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Chart 2: Balance Burndown (descending) */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-300">
            Account Balance Burndown
            {runwayMonth && (
              <span className="ml-3 text-xs font-normal text-red-400">
                ↓ Balance reaches zero around {fmtMonth(runwayMonth)}
              </span>
            )}
            {currentBalance == null && (
              <span className="ml-3 text-xs font-normal text-gray-500">
                (No balance data — import NAB statements to see this chart)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chart2Data}>
              <defs>
                <linearGradient id="burnActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="burnProjected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={fmtMonth} />
              <YAxis
                stroke="#6b7280"
                tick={{ fontSize: 10 }}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                formatter={(v, name) => [
                  `$${typeof v === 'number' ? fmt(v) : v}`,
                  name === 'actualBalance' ? 'Actual Balance' : 'Projected Balance',
                ]}
                labelFormatter={(label: unknown) => typeof label === 'string' ? fmtMonth(label) : String(label)}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }}
              />
              {/* Zero line — money runs out here */}
              <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 2"
                label={{ value: '$0 — Runway ends', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }} />
              {/* Today divider */}
              <ReferenceLine x={currentMonth} stroke="#6b7280" strokeDasharray="4 2"
                label={{ value: 'Today', fill: '#9ca3af', fontSize: 10 }} />
              {/* Runway month */}
              {runwayMonth && (
                <ReferenceLine x={runwayMonth} stroke="#ef4444" strokeOpacity={0.5} strokeDasharray="3 2"
                  label={{ value: '⚠ Zero', fill: '#ef4444', fontSize: 10 }} />
              )}
              <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
              {/* Actual historical balance — solid emerald, going down */}
              <Area
                type="monotone"
                dataKey="actualBalance"
                name="actualBalance"
                stroke="#34d399"
                fill="url(#burnActual)"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
              {/* Projected balance — dashed violet, continues the descent */}
              <Area
                type="monotone"
                dataKey="projectedBalance"
                name="projectedBalance"
                stroke="#a78bfa"
                fill="url(#burnProjected)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Forecast Table */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm text-gray-300">Forecast Table — past 6 months · next 12 months (editable)</CardTitle>
            <div className="flex items-center gap-2 flex-shrink-0 relative">

              {/* Scenario selector dropdown */}
              <div className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <select
                  value={activeScenarioId ?? 'default'}
                  onChange={e => switchScenario(e.target.value === 'default' ? null : e.target.value)}
                  className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded px-2 py-1 outline-none focus:border-violet-600 transition-colors cursor-pointer max-w-[160px]"
                  disabled={loadingScenario}
                  title="Switch scenario"
                >
                  <option value="default">Default (live)</option>
                  {scenarios.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {loadingScenario && <span className="text-xs text-violet-400">Loading…</span>}
              </div>

              {/* Save scenario (updates in place if named; prompts for name if Default) */}
              {creatingScenario ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    className="w-36 bg-gray-800 border border-violet-500 text-gray-100 text-xs px-2 py-1 rounded outline-none"
                    value={newScenarioName}
                    onChange={e => setNewScenarioName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') createScenario();
                      if (e.key === 'Escape') { setCreatingScenario(false); setNewScenarioName(''); }
                    }}
                    placeholder="Scenario name…"
                  />
                  <button
                    className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded transition-colors disabled:opacity-50"
                    onClick={createScenario}
                    disabled={scenarioSaving || !newScenarioName.trim()}
                  >
                    {scenarioSaving ? '…' : 'Save'}
                  </button>
                  <button
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                    onClick={() => { setCreatingScenario(false); setNewScenarioName(''); }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-violet-900/40 hover:bg-violet-800/50 text-violet-300 rounded border border-violet-800 transition-colors disabled:opacity-50"
                  onClick={handleSave}
                  disabled={scenarioSaving}
                  title={activeScenarioId ? 'Save changes to this scenario' : 'Save current forecast as a new scenario'}
                >
                  <Save className="w-3.5 h-3.5" />
                  {activeScenarioId ? 'Save' : 'Save as…'}
                </button>
              )}

              {/* Delete current scenario (only shown when a named scenario is active) */}
              {activeScenarioId && !creatingScenario && (
                <button
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-400 rounded border border-gray-700 hover:border-red-800 transition-colors"
                  onClick={deleteCurrentScenario}
                  title="Delete this scenario"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}

              {/* Reset to baseline */}
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-800 hover:bg-red-900/40 text-gray-300 hover:text-red-300 rounded border border-gray-700 hover:border-red-800 transition-colors"
                onClick={newForecast}
                title="Reset to baseline (clear all overrides)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Click any future cell to override · ≡ for bulk row edit · grey italic = projected average</p>
        </CardHeader>
        <CardContent className="p-0">
          <StickyScrollX>
            <table className="min-w-max text-xs border-collapse">
              {/* Header */}
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="sticky left-0 z-10 bg-gray-900 text-left px-3 py-2 text-gray-400 font-medium min-w-[220px] border-r border-gray-800">
                    Category / Subcategory
                  </th>
                  {allMonths.map((month, idx) => {
                    const isFutureCol = idx >= firstFutureIdx;
                    return (
                      <th
                        key={month}
                        className={cn(
                          'text-right px-2 py-2 font-medium whitespace-nowrap min-w-[80px]',
                          isFutureCol
                            ? 'text-violet-300 bg-violet-950/20 border-l border-violet-900/30'
                            : 'text-gray-500'
                        )}
                      >
                        {fmtMonth(month)}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {CATEGORIES.map(catDef => {
                  const isOpen = catOpen[catDef.slug] ?? false;
                  const color = getCategoryColor(catDef.slug);
                  const allSubs = [
                    ...catDef.subcategories.map(s => ({ slug: s.slug, label: s.label, isCustom: false })),
                    ...(customSubcatDefs[catDef.slug] ?? []).map(cs => ({ slug: cs.slug, label: cs.label, isCustom: true })),
                  ];

                  // Category row totals
                  const catMonthTotals = allMonths.map((month, idx) => {
                    const isFuture = idx >= firstFutureIdx;
                    return allSubs.reduce((acc, sub) => acc + getCellValue(catDef.slug, sub.slug, month, isFuture).value, 0);
                  });

                  return [
                    // ── Category row ────────────────────────────────────────
                    <tr
                      key={`cat-${catDef.slug}`}
                      className="border-b border-gray-800 hover:bg-gray-800/40 cursor-pointer"
                      onClick={() => setCatOpen(prev => ({ ...prev, [catDef.slug]: !isOpen }))}
                    >
                      <td className="sticky left-0 z-10 bg-gray-900 px-3 py-2 border-r border-gray-800">
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          )}
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-semibold text-gray-200">{catDef.label}</span>
                          {isOpen && (
                            <button
                              className="ml-auto text-gray-500 hover:text-violet-400 transition-colors"
                              onClick={e => { e.stopPropagation(); setAddingTo(addingTo === catDef.slug ? null : catDef.slug); }}
                              title="Add custom row"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      {allMonths.map((month, idx) => {
                        const isFutureCol = idx >= firstFutureIdx;
                        const val = catMonthTotals[idx];
                        return (
                          <td
                            key={month}
                            className={cn(
                              'text-right px-2 py-2 whitespace-nowrap font-medium',
                              isFutureCol
                                ? 'bg-violet-950/10 border-l border-violet-900/20 text-violet-300'
                                : val !== 0
                                ? catDef.isExpense ? 'text-red-300' : 'text-emerald-300'
                                : 'text-gray-600'
                            )}
                          >
                            {fmtCell(val)}
                          </td>
                        );
                      })}
                    </tr>,

                    // ── Subcategory rows (when open) ─────────────────────────
                    ...(isOpen ? allSubs.map(subDef => {
                      const drillKey = `${catDef.slug}__${subDef.slug}`;
                      const isDrilled = subDrilled[drillKey] ?? false;
                      const isBulkEditing = bulkEdit?.cat === catDef.slug && bulkEdit?.sub === subDef.slug;

                      const subRows = [
                        // Subcategory row
                        <tr
                          key={`sub-${catDef.slug}-${subDef.slug}`}
                          className="border-b border-gray-800/60 bg-gray-900/50 hover:bg-gray-800/30"
                        >
                          <td className="sticky left-0 z-10 bg-gray-900/80 px-3 py-1.5 border-r border-gray-800">
                            <div className="flex items-center gap-2 pl-4">
                              <button
                                className="text-gray-600 hover:text-gray-400"
                                onClick={() => setSubDrilled(prev => ({ ...prev, [drillKey]: !isDrilled }))}
                                title="Drill into transactions"
                              >
                                {isDrilled ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                              </button>
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color, opacity: 0.6 }}
                              />
                              <span className="text-gray-300">{subDef.label}</span>
                              <div className="ml-auto flex items-center gap-1">
                                <button
                                  className="text-gray-600 hover:text-violet-400 transition-colors"
                                  onClick={() => setBulkEdit(isBulkEditing ? null : { cat: catDef.slug, sub: subDef.slug, value: '' })}
                                  title="Set all future months at once"
                                >
                                  <AlignJustify className="w-3 h-3" />
                                </button>
                                {subDef.isCustom && (
                                  <button
                                    className="text-gray-600 hover:text-red-400 transition-colors"
                                    onClick={() => removeAllOverridesForSubcat(catDef.slug, subDef.slug)}
                                    title="Delete this custom row"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          {allMonths.map((month, idx) => {
                            const isFutureCol = idx >= firstFutureIdx;
                            const { value, isOverride, isProjected } = getCellValue(catDef.slug, subDef.slug, month, isFutureCol);
                            const isEditing = editingCell?.cat === catDef.slug && editingCell?.sub === subDef.slug && editingCell?.month === month;

                            if (!isFutureCol) {
                              // Past cell — read-only
                              return (
                                <td key={month} className="text-right px-2 py-1.5 text-gray-400 whitespace-nowrap">
                                  {fmtCell(value)}
                                </td>
                              );
                            }

                            // Future cell — editable
                            return (
                              <td
                                key={month}
                                className={cn(
                                  'text-right px-2 py-1.5 whitespace-nowrap border-l border-violet-900/20 bg-violet-950/10',
                                  'cursor-pointer hover:bg-violet-900/20 transition-colors'
                                )}
                                onClick={e => {
                                  e.stopPropagation();
                                  if (!isEditing) {
                                    setEditingCell({
                                      cat: catDef.slug,
                                      sub: subDef.slug,
                                      month,
                                      value: value !== 0 ? String(Math.abs(value)) : '',
                                    });
                                  }
                                }}
                              >
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    className="w-16 text-right bg-gray-800 border border-violet-500 text-gray-100 text-xs px-1 py-0.5 rounded outline-none"
                                    value={editingCell.value}
                                    onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                                    onBlur={e => {
                                      // guard: don't double-save if Enter already handled it
                                      if (editingCell && e.currentTarget.dataset.saved !== 'true') {
                                        saveCell(catDef.slug, subDef.slug, month, editingCell.value, catDef.isExpense);
                                      }
                                    }}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.currentTarget.dataset.saved = 'true'; // flag so onBlur skips
                                        saveCell(catDef.slug, subDef.slug, month, editingCell.value, catDef.isExpense);
                                      }
                                      if (e.key === 'Escape') {
                                        e.currentTarget.dataset.saved = 'true';
                                        setEditingCell(null);
                                      }
                                    }}
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (
                                  <span className="flex items-center justify-end gap-1">
                                    <span className={cn(isProjected ? 'text-gray-500 italic' : 'text-violet-300')}>
                                      {fmtCell(value)}
                                    </span>
                                    {isOverride && (
                                      <button
                                        className="text-gray-600 hover:text-red-400"
                                        onClick={e => { e.stopPropagation(); removeOverride(catDef.slug, subDef.slug, month); }}
                                        title="Clear override"
                                      >
                                        <X className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>,

                        // Bulk edit row
                        ...(isBulkEditing ? [
                          <tr key={`bulk-${catDef.slug}-${subDef.slug}`} className="border-b border-violet-900/30 bg-violet-950/20">
                            <td className="sticky left-0 z-10 bg-violet-950/30 px-3 py-2 border-r border-gray-800" />
                            <td colSpan={pastMonths.length} className="px-2 py-2 text-gray-500 text-xs italic">
                              (past months)
                            </td>
                            <td colSpan={futureMonths.length} className="px-2 py-1.5">
                              <div className="flex items-center gap-2 justify-end">
                                <span className="text-gray-400 text-xs">Set all future months:</span>
                                <input
                                  autoFocus
                                  className="w-20 text-right bg-gray-800 border border-violet-500 text-gray-100 text-xs px-1.5 py-1 rounded outline-none"
                                  value={bulkEdit.value}
                                  onChange={e => setBulkEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveAllFuture(catDef.slug, subDef.slug, bulkEdit.value, catDef.isExpense);
                                    if (e.key === 'Escape') setBulkEdit(null);
                                  }}
                                  placeholder="amount"
                                />
                                <button
                                  className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded transition-colors"
                                  onClick={() => saveAllFuture(catDef.slug, subDef.slug, bulkEdit.value, catDef.isExpense)}
                                >
                                  Apply
                                </button>
                                <button
                                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                                  onClick={() => setBulkEdit(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>,
                        ] : []),

                        // Drill-down transaction rows (past months only)
                        ...(isDrilled ? pastMonths.map(month => {
                          const monthTxns = transactions.filter(t =>
                            t.date.slice(0, 7) === month &&
                            (t.category ?? 'other_expenses') === catDef.slug &&
                            (t.subcategory ?? 'miscellaneous') === subDef.slug
                          );
                          if (monthTxns.length === 0) return null;
                          return monthTxns.map(txn => (
                            <tr
                              key={`txn-${txn.id}-${month}`}
                              className="border-b border-gray-800/30 bg-gray-900/20 hover:bg-gray-800/20 cursor-pointer"
                              onClick={() => router.push(`/transactions?id=${txn.id}`)}
                            >
                              <td className="sticky left-0 z-10 bg-gray-900/40 px-3 py-1 border-r border-gray-800">
                                <div className="flex items-center gap-2 pl-8">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-gray-500 truncate text-xs">
                                      {txn.merchantName ?? txn.transactionDetails ?? '—'}
                                    </div>
                                    {txn.notes && (
                                      <div className="text-amber-300/80 text-[10px] italic truncate mt-0.5" title={txn.notes}>
                                        {txn.notes}
                                      </div>
                                    )}
                                  </div>
                                  <span className={cn(
                                    'text-[10px] px-1 py-0.5 rounded',
                                    txn.source === 'nab' ? 'bg-blue-900/40 text-blue-300' : 'bg-green-900/40 text-green-300'
                                  )}>
                                    {txn.source}
                                  </span>
                                </div>
                              </td>
                              {allMonths.map((mo, idx) => (
                                <td
                                  key={mo}
                                  className={cn(
                                    'text-right px-2 py-1 text-xs whitespace-nowrap',
                                    idx >= firstFutureIdx ? 'bg-violet-950/10 border-l border-violet-900/20' : ''
                                  )}
                                >
                                  {mo === month ? (
                                    <span className={txn.amount < 0 ? 'text-red-400' : 'text-emerald-400'}>
                                      {fmtCell(txn.amount)}
                                    </span>
                                  ) : null}
                                </td>
                              ))}
                            </tr>
                          ));
                        }).flat().filter((r): r is React.ReactElement => r !== null) : []),
                      ];

                      return subRows;
                    }).flat() : []),

                    // ── Add custom subcategory row ────────────────────────────
                    ...(isOpen && addingTo === catDef.slug ? [
                      <tr key={`add-${catDef.slug}`} className="border-b border-violet-900/30 bg-violet-950/10">
                        <td className="sticky left-0 z-10 bg-violet-950/20 px-3 py-2 border-r border-gray-800">
                          <div className="flex items-center gap-2 pl-5">
                            <input
                              autoFocus
                              className="flex-1 bg-gray-800 border border-violet-500 text-gray-100 text-xs px-2 py-1 rounded outline-none"
                              value={newSubcatLabel}
                              onChange={e => setNewSubcatLabel(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') addCustomSubcat(catDef.slug, newSubcatLabel);
                                if (e.key === 'Escape') { setAddingTo(null); setNewSubcatLabel(''); }
                              }}
                              placeholder="New row label..."
                            />
                            <button
                              className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded"
                              onClick={() => addCustomSubcat(catDef.slug, newSubcatLabel)}
                            >
                              Add
                            </button>
                            <button
                              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded"
                              onClick={() => { setAddingTo(null); setNewSubcatLabel(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                        {allMonths.map((month, idx) => (
                          <td
                            key={month}
                            className={cn(
                              'px-2 py-2',
                              idx >= firstFutureIdx ? 'bg-violet-950/10 border-l border-violet-900/20' : ''
                            )}
                          />
                        ))}
                      </tr>,
                    ] : []),
                  ];
                })}

                {/* ── Custom (forecast-only) category rows ────────────────── */}
                {Object.entries(customCatDefs).map(([catSlug, catDef]) => {
                  const isOpen = catOpen[catSlug] ?? false;
                  const color = catDef.isExpense ? '#f97316' : '#22d3ee';

                  const catMonthTotals = allMonths.map((month, idx) => {
                    const isFuture = idx >= firstFutureIdx;
                    return catDef.subcats.reduce((acc, sub) => acc + getCellValue(catSlug, sub.slug, month, isFuture).value, 0);
                  });

                  return [
                    // Category row
                    <tr
                      key={`customcat-${catSlug}`}
                      className="border-b border-gray-800 hover:bg-gray-800/40 cursor-pointer"
                      onClick={() => setCatOpen(prev => ({ ...prev, [catSlug]: !isOpen }))}
                    >
                      <td className="sticky left-0 z-10 bg-gray-900 px-3 py-2 border-r border-gray-800">
                        <div className="flex items-center gap-2">
                          {isOpen ? <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />}
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-semibold text-gray-200">{catDef.label}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded border border-orange-800/60 text-orange-400/80 bg-orange-950/30 ml-1">
                            {catDef.isExpense ? 'forecast expense' : 'forecast revenue'}
                          </span>
                          {isOpen && (
                            <>
                              <button
                                className="ml-auto text-gray-500 hover:text-violet-400 transition-colors"
                                onClick={e => { e.stopPropagation(); setAddingTo(addingTo === catSlug ? null : catSlug); }}
                                title="Add subcategory row"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              <button
                                className="text-gray-600 hover:text-red-400 transition-colors"
                                onClick={e => { e.stopPropagation(); if (confirm(`Delete "${catDef.label}" and all its forecast data?`)) removeCustomCategory(catSlug); }}
                                title="Delete this custom category"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      {allMonths.map((month, idx) => {
                        const isFutureCol = idx >= firstFutureIdx;
                        const val = catMonthTotals[idx];
                        return (
                          <td key={month} className={cn('text-right px-2 py-2 whitespace-nowrap font-medium', isFutureCol ? 'bg-violet-950/10 border-l border-violet-900/20 text-violet-300' : val !== 0 ? catDef.isExpense ? 'text-red-300' : 'text-emerald-300' : 'text-gray-600')}>
                            {fmtCell(val)}
                          </td>
                        );
                      })}
                    </tr>,

                    // Subcategory rows
                    ...(isOpen ? catDef.subcats.map(subDef => {
                      const isBulkEditing = bulkEdit?.cat === catSlug && bulkEdit?.sub === subDef.slug;
                      return [
                        <tr key={`customsub-${catSlug}-${subDef.slug}`} className="border-b border-gray-800/60 bg-gray-900/50 hover:bg-gray-800/30">
                          <td className="sticky left-0 z-10 bg-gray-900/80 px-3 py-1.5 border-r border-gray-800">
                            <div className="flex items-center gap-2 pl-4">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, opacity: 0.6 }} />
                              <span className="text-gray-300">{subDef.label}</span>
                              <div className="ml-auto flex items-center gap-1">
                                <button
                                  className="text-gray-600 hover:text-violet-400 transition-colors"
                                  onClick={() => setBulkEdit(isBulkEditing ? null : { cat: catSlug, sub: subDef.slug, value: '' })}
                                  title="Set all future months at once"
                                >
                                  <AlignJustify className="w-3 h-3" />
                                </button>
                                <button
                                  className="text-gray-600 hover:text-red-400 transition-colors"
                                  onClick={() => removeAllOverridesForSubcat(catSlug, subDef.slug)}
                                  title="Delete this row"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </td>
                          {allMonths.map((month, idx) => {
                            const isFutureCol = idx >= firstFutureIdx;
                            const { value, isOverride } = getCellValue(catSlug, subDef.slug, month, isFutureCol);
                            const isEditing = editingCell?.cat === catSlug && editingCell?.sub === subDef.slug && editingCell?.month === month;
                            if (!isFutureCol) {
                              return <td key={month} className="text-right px-2 py-1.5 text-gray-600 whitespace-nowrap">—</td>;
                            }
                            return (
                              <td key={month} className={cn('text-right px-2 py-1.5 whitespace-nowrap border-l border-violet-900/20 bg-violet-950/10', 'cursor-pointer hover:bg-violet-900/20 transition-colors')}
                                onClick={e => { e.stopPropagation(); if (!isEditing) setEditingCell({ cat: catSlug, sub: subDef.slug, month, value: value !== 0 ? String(Math.abs(value)) : '' }); }}
                              >
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    className="w-16 text-right bg-gray-800 border border-violet-500 text-gray-100 text-xs px-1 py-0.5 rounded outline-none"
                                    value={editingCell.value}
                                    onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : null)}
                                    onBlur={e => { if (editingCell && e.currentTarget.dataset.saved !== 'true') saveCell(catSlug, subDef.slug, month, editingCell.value, catDef.isExpense); }}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.dataset.saved = 'true'; saveCell(catSlug, subDef.slug, month, editingCell.value, catDef.isExpense); }
                                      if (e.key === 'Escape') { e.currentTarget.dataset.saved = 'true'; setEditingCell(null); }
                                    }}
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (
                                  <span className="flex items-center justify-end gap-1">
                                    <span className={cn(value === 0 ? 'text-gray-600' : 'text-violet-300')}>{fmtCell(value)}</span>
                                    {isOverride && value !== 0 && (
                                      <button className="text-gray-600 hover:text-red-400" onClick={e => { e.stopPropagation(); removeOverride(catSlug, subDef.slug, month); }} title="Clear override"><X className="w-2.5 h-2.5" /></button>
                                    )}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>,

                        // Bulk edit row for custom category subcats
                        ...(isBulkEditing ? [
                          <tr key={`custombulk-${catSlug}-${subDef.slug}`} className="border-b border-violet-900/30 bg-violet-950/20">
                            <td className="sticky left-0 z-10 bg-violet-950/30 px-3 py-2 border-r border-gray-800" />
                            <td colSpan={pastMonths.length} className="px-2 py-2 text-gray-500 text-xs italic">(past months)</td>
                            <td colSpan={futureMonths.length} className="px-2 py-1.5">
                              <div className="flex items-center gap-2 justify-end">
                                <span className="text-gray-400 text-xs">Set all future months:</span>
                                <input
                                  autoFocus
                                  className="w-20 text-right bg-gray-800 border border-violet-500 text-gray-100 text-xs px-1.5 py-1 rounded outline-none"
                                  value={bulkEdit.value}
                                  onChange={e => setBulkEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveAllFuture(catSlug, subDef.slug, bulkEdit.value, catDef.isExpense);
                                    if (e.key === 'Escape') setBulkEdit(null);
                                  }}
                                  placeholder="amount"
                                />
                                <button className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded" onClick={() => saveAllFuture(catSlug, subDef.slug, bulkEdit.value, catDef.isExpense)}>Apply</button>
                                <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded" onClick={() => setBulkEdit(null)}>Cancel</button>
                              </div>
                            </td>
                          </tr>,
                        ] : []),
                      ];
                    }).flat() : []),

                    // Add subcategory row for custom categories
                    ...(isOpen && addingTo === catSlug ? [
                      <tr key={`addcustomsub-${catSlug}`} className="border-b border-violet-900/30 bg-violet-950/10">
                        <td className="sticky left-0 z-10 bg-violet-950/20 px-3 py-2 border-r border-gray-800">
                          <div className="flex items-center gap-2 pl-5">
                            <input
                              autoFocus
                              className="flex-1 bg-gray-800 border border-violet-500 text-gray-100 text-xs px-2 py-1 rounded outline-none"
                              value={newSubcatLabel}
                              onChange={e => setNewSubcatLabel(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') addCustomSubcat(catSlug, newSubcatLabel, catDef.label);
                                if (e.key === 'Escape') { setAddingTo(null); setNewSubcatLabel(''); }
                              }}
                              placeholder="New row label..."
                            />
                            <button className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded" onClick={() => addCustomSubcat(catSlug, newSubcatLabel, catDef.label)}>Add</button>
                            <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded" onClick={() => { setAddingTo(null); setNewSubcatLabel(''); }}>Cancel</button>
                          </div>
                        </td>
                        {allMonths.map((month, idx) => <td key={month} className={cn('px-2 py-2', idx >= firstFutureIdx ? 'bg-violet-950/10 border-l border-violet-900/20' : '')} />)}
                      </tr>,
                    ] : []),
                  ];
                }).flat()}

                {/* Add custom category row */}
                <tr className="border-b border-gray-800/40">
                  <td className="sticky left-0 z-10 bg-gray-900 px-3 py-1.5 border-r border-gray-800" colSpan={1}>
                    {addingCategory ? (
                      <div className="flex items-center gap-2">
                        <Layers className="w-3 h-3 text-orange-400 flex-shrink-0" />
                        <input
                          autoFocus
                          className="w-40 bg-gray-800 border border-orange-500 text-gray-100 text-xs px-2 py-1 rounded outline-none"
                          value={newCatLabel}
                          onChange={e => setNewCatLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') addCustomCategory(newCatLabel, newCatIsExpense);
                            if (e.key === 'Escape') { setAddingCategory(false); setNewCatLabel(''); }
                          }}
                          placeholder="Category name..."
                        />
                        <div className="flex rounded overflow-hidden border border-gray-600 text-[10px]">
                          <button
                            className={cn('px-2 py-1 transition-colors', newCatIsExpense ? 'bg-red-900/60 text-red-300' : 'bg-gray-800 text-gray-500 hover:text-gray-300')}
                            onClick={() => setNewCatIsExpense(true)}
                          >Expense</button>
                          <button
                            className={cn('px-2 py-1 transition-colors', !newCatIsExpense ? 'bg-emerald-900/60 text-emerald-300' : 'bg-gray-800 text-gray-500 hover:text-gray-300')}
                            onClick={() => setNewCatIsExpense(false)}
                          >Revenue</button>
                        </div>
                        <button className="px-2 py-1 bg-orange-700 hover:bg-orange-600 text-white text-xs rounded" onClick={() => addCustomCategory(newCatLabel, newCatIsExpense)}>Add</button>
                        <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded" onClick={() => { setAddingCategory(false); setNewCatLabel(''); }}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1.5 text-gray-600 hover:text-orange-400 text-xs transition-colors py-0.5"
                        onClick={() => setAddingCategory(true)}
                      >
                        <Plus className="w-3 h-3" />
                        Add Forecast Category
                      </button>
                    )}
                  </td>
                  {!addingCategory && allMonths.map((month, idx) => (
                    <td key={month} className={cn('', idx >= firstFutureIdx ? 'bg-violet-950/5 border-l border-violet-900/10' : '')} />
                  ))}
                </tr>

                {/* Grand total row */}
                <tr className="border-t-2 border-gray-600 bg-gray-800/50">
                  <td className="sticky left-0 z-10 bg-gray-800 px-3 py-2 border-r border-gray-700 font-bold text-gray-200">
                    Grand Total
                  </td>
                  {allMonths.map((month, idx) => {
                    const isFutureCol = idx >= firstFutureIdx;
                    const total = getGrandTotal(month, isFutureCol);
                    return (
                      <td
                        key={month}
                        className={cn(
                          'text-right px-2 py-2 font-bold whitespace-nowrap',
                          isFutureCol
                            ? 'bg-violet-950/20 border-l border-violet-900/30 text-violet-200'
                            : total < 0 ? 'text-red-300' : total > 0 ? 'text-emerald-300' : 'text-gray-600'
                        )}
                      >
                        {fmtCell(total)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </StickyScrollX>
        </CardContent>
      </Card>
    </div>
  );
}
