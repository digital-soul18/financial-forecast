'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calculator,
  TrendingUp,
  Cpu,
  Phone,
  DollarSign,
  Target,
  AlertTriangle,
  RotateCcw,
  Zap,
  Users,
  Globe,
  Info,
} from 'lucide-react';

// ── Formatting ──────────────────────────────────────────────────────────────────

const fmtAUD0 = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-AU')}`;
const fmtAUD2 = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
const fmtNum = (n: number) => Math.round(n).toLocaleString('en-AU');

// ── Scenario presets ────────────────────────────────────────────────────────────

interface Scenario {
  // Pricing
  setupFee: number;
  monthlyFee: number;
  includedMinutes: number;
  overageRate: number;
  // Customer behavior
  avgMinutesPerMonth: number;
  tenureMonths: number;
  // Costs (USD/min before FX)
  fxRate: number;
  llmCostUSD: number;
  telephonyCostUSD: number;
  monthlyGPULease: number;
  // Acquisition (per quarter — Q1..Q12)
  newCustomersPerMonth: number[]; // 12 quarters
  // Marketing budget (per quarter, AUD/month within that quarter)
  marketingPerMonth: number[]; // 12 quarters
  // Other OpEx (per quarter, AUD/month within that quarter)
  otherOpexPerMonth: number[]; // 12 quarters
  // Cash
  startingCash: number;
  seedRaise: number;
  seedRaiseMonth: number; // 0-indexed month when raise lands (0 = month 1)
}

const BASE_NEW_CUST = [5, 5, 5, 9, 9, 9, 14, 14, 14, 15, 15, 15];
const BASE_MARKETING = [1800, 1800, 1800, 5800, 5800, 5800, 10000, 10000, 10000, 12000, 12000, 12000];
// Salaries + tooling + admin only (usage costs are variable COGS, marketing is separate).
// Ramps gently from ~$20K (founders + small team today) to ~$30K cap.
const BASE_OTHER_OPEX = [20000, 22000, 24000, 25000, 26000, 27000, 28000, 28000, 29000, 30000, 30000, 30000];

const PRESETS: Record<string, Scenario> = {
  base: {
    setupFee: 599,
    monthlyFee: 579,
    includedMinutes: 1000,
    overageRate: 0.45,
    avgMinutesPerMonth: 1500,
    tenureMonths: 12,
    fxRate: 1.55,
    llmCostUSD: 0.07,
    telephonyCostUSD: 0.033,
    monthlyGPULease: 0,
    newCustomersPerMonth: BASE_NEW_CUST,
    marketingPerMonth: BASE_MARKETING,
    otherOpexPerMonth: BASE_OTHER_OPEX,
    startingCash: 50000,
    seedRaise: 1_200_000,
    seedRaiseMonth: 0,
  },
  postRaise: {
    setupFee: 599,
    monthlyFee: 579,
    includedMinutes: 1000,
    overageRate: 0.45,
    avgMinutesPerMonth: 1500,
    tenureMonths: 12,
    fxRate: 1.55,
    llmCostUSD: 0.035, // dedicated AU GPU brings LLM down
    telephonyCostUSD: 0.025, // volume discount
    monthlyGPULease: 14000, // primary + dev
    newCustomersPerMonth: BASE_NEW_CUST,
    marketingPerMonth: BASE_MARKETING,
    otherOpexPerMonth: BASE_OTHER_OPEX,
    startingCash: 50000,
    seedRaise: 1_200_000,
    seedRaiseMonth: 0,
  },
  bear: {
    setupFee: 599,
    monthlyFee: 579,
    includedMinutes: 1000,
    overageRate: 0.45,
    avgMinutesPerMonth: 1200,
    tenureMonths: 8,
    fxRate: 1.55,
    llmCostUSD: 0.07,
    telephonyCostUSD: 0.033,
    monthlyGPULease: 0,
    newCustomersPerMonth: BASE_NEW_CUST.map((n) => Math.round(n * 0.7)),
    marketingPerMonth: BASE_MARKETING,
    otherOpexPerMonth: BASE_OTHER_OPEX,
    startingCash: 50000,
    seedRaise: 500_000,
    seedRaiseMonth: 0,
  },
  bull: {
    setupFee: 599,
    monthlyFee: 579,
    includedMinutes: 1000,
    overageRate: 0.45,
    avgMinutesPerMonth: 1800,
    tenureMonths: 18,
    fxRate: 1.55,
    llmCostUSD: 0.05,
    telephonyCostUSD: 0.028,
    monthlyGPULease: 14000,
    newCustomersPerMonth: BASE_NEW_CUST.map((n) => Math.round(n * 1.3)),
    marketingPerMonth: BASE_MARKETING,
    otherOpexPerMonth: BASE_OTHER_OPEX,
    startingCash: 50000,
    seedRaise: 1_200_000,
    seedRaiseMonth: 0,
  },
  minRaise: {
    setupFee: 599,
    monthlyFee: 579,
    includedMinutes: 1000,
    overageRate: 0.45,
    avgMinutesPerMonth: 1500,
    tenureMonths: 12,
    fxRate: 1.55,
    llmCostUSD: 0.07,
    telephonyCostUSD: 0.033,
    monthlyGPULease: 0,
    newCustomersPerMonth: BASE_NEW_CUST.map((n) => Math.round(n * 0.55)),
    marketingPerMonth: [800, 800, 800, 2200, 2200, 2200, 3500, 3500, 3500, 4000, 4000, 4000],
    otherOpexPerMonth: [18000, 20000, 22000, 23000, 24000, 25000, 26000, 26000, 27000, 28000, 28000, 28000],
    startingCash: 50000,
    seedRaise: 500_000,
    seedRaiseMonth: 0,
  },
};

// ── Projection engine ───────────────────────────────────────────────────────────

interface MonthRow {
  month: number; // 1-indexed
  quarter: number; // 1-indexed
  yearLabel: string;
  newCust: number;
  activeCust: number;
  setupRev: number;
  subRev: number;
  totalRev: number;
  variableCogs: number;
  gpuLease: number;
  marketing: number;
  otherOpex: number;
  totalCosts: number;
  ebitda: number;
  cumulativeCash: number;
}

function project(s: Scenario, months = 36): MonthRow[] {
  const variableCostPerMin =
    (s.llmCostUSD + s.telephonyCostUSD) * s.fxRate; // AUD/min
  const overageMins = Math.max(0, s.avgMinutesPerMonth - s.includedMinutes);
  const subPerCust = s.monthlyFee + overageMins * s.overageRate;
  const monthlyChurn = s.tenureMonths > 0 ? 1 / s.tenureMonths : 0;

  // Active customer cohort tracking via exponential retention
  const activeByMonth: number[] = new Array(months).fill(0);
  const newCustByMonth: number[] = new Array(months).fill(0);

  for (let m = 0; m < months; m++) {
    const q = Math.min(11, Math.floor(m / 3));
    newCustByMonth[m] = s.newCustomersPerMonth[q] ?? 0;
  }

  // Compute active customers using cohort decay
  for (let m = 0; m < months; m++) {
    let active = 0;
    for (let k = 0; k <= m; k++) {
      const age = m - k;
      active += newCustByMonth[k] * Math.pow(1 - monthlyChurn, age);
    }
    activeByMonth[m] = active;
  }

  const rows: MonthRow[] = [];
  let cum = s.startingCash;

  for (let m = 0; m < months; m++) {
    const q = Math.min(11, Math.floor(m / 3));
    const newCust = newCustByMonth[m];
    const active = activeByMonth[m];
    const setupRev = newCust * s.setupFee;
    const subRev = active * subPerCust;
    const totalRev = setupRev + subRev;
    const variableCogs = active * s.avgMinutesPerMonth * variableCostPerMin;
    const gpuLease = s.monthlyGPULease;
    const marketing = s.marketingPerMonth[q] ?? 0;
    const otherOpex = s.otherOpexPerMonth[q] ?? 0;
    const totalCosts = variableCogs + gpuLease + marketing + otherOpex;
    const ebitda = totalRev - totalCosts;

    if (m === s.seedRaiseMonth) cum += s.seedRaise;
    cum += ebitda;

    const yearIdx = Math.floor(m / 12);
    rows.push({
      month: m + 1,
      quarter: Math.floor(m / 3) + 1,
      yearLabel: `Y${yearIdx + 1}`,
      newCust,
      activeCust: active,
      setupRev,
      subRev,
      totalRev,
      variableCogs,
      gpuLease,
      marketing,
      otherOpex,
      totalCosts,
      ebitda,
      cumulativeCash: cum,
    });
  }
  return rows;
}

// ── Annualizer ──────────────────────────────────────────────────────────────────

interface YearSummary {
  year: number;
  newCust: number;
  yearEndActive: number;
  setupRev: number;
  subRev: number;
  totalRev: number;
  variableCogs: number;
  gpuLease: number;
  marketing: number;
  otherOpex: number;
  totalOpex: number;
  ebitda: number;
  grossMargin: number;
}

function annualize(rows: MonthRow[]): YearSummary[] {
  const out: YearSummary[] = [];
  for (let y = 0; y < 3; y++) {
    const slice = rows.slice(y * 12, y * 12 + 12);
    if (!slice.length) break;
    const setupRev = slice.reduce((a, r) => a + r.setupRev, 0);
    const subRev = slice.reduce((a, r) => a + r.subRev, 0);
    const totalRev = setupRev + subRev;
    const variableCogs = slice.reduce((a, r) => a + r.variableCogs, 0);
    const gpuLease = slice.reduce((a, r) => a + r.gpuLease, 0);
    const marketing = slice.reduce((a, r) => a + r.marketing, 0);
    const otherOpex = slice.reduce((a, r) => a + r.otherOpex, 0);
    const totalOpex = marketing + otherOpex;
    const grossProfit = totalRev - variableCogs - gpuLease;
    const ebitda = grossProfit - totalOpex;
    out.push({
      year: y + 1,
      newCust: slice.reduce((a, r) => a + r.newCust, 0),
      yearEndActive: slice[slice.length - 1].activeCust,
      setupRev,
      subRev,
      totalRev,
      variableCogs,
      gpuLease,
      marketing,
      otherOpex,
      totalOpex,
      ebitda,
      grossMargin: totalRev > 0 ? grossProfit / totalRev : 0,
    });
  }
  return out;
}

// ── UI helpers ──────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

function NumField({ label, value, onChange, step = 1, min, prefix, suffix, decimals }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-gray-400">{label}</span>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
            {prefix}
          </span>
        )}
        <input
          type="number"
          step={step}
          min={min}
          value={Number.isFinite(value) ? (decimals !== undefined ? value.toFixed(decimals) : value) : ''}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className={`w-full rounded-md bg-gray-950 border border-gray-700 text-sm text-gray-100 px-2 py-1.5 ${
            prefix ? 'pl-6' : ''
          } ${suffix ? 'pr-10' : ''} focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500`}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function ArrayField({
  label,
  values,
  onChange,
  prefix,
  suffix,
  step = 1,
}: {
  label: string;
  values: number[];
  onChange: (next: number[]) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-gray-400">{label}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {values.map((v, i) => (
          <div key={i} className="relative">
            <span className="absolute left-1.5 top-1 text-[10px] text-gray-600 font-mono">
              Q{i + 1}
            </span>
            <input
              type="number"
              step={step}
              value={v}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                const next = [...values];
                next[i] = Number.isFinite(n) ? n : 0;
                onChange(next);
              }}
              className="w-full rounded-md bg-gray-950 border border-gray-700 text-xs text-gray-100 pl-7 pr-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
              title={`Quarter ${i + 1} (months ${i * 3 + 1}–${i * 3 + 3})`}
            />
          </div>
        ))}
      </div>
      {(prefix || suffix) && (
        <p className="text-[10px] text-gray-600">
          {prefix}per month within each quarter{suffix}
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = 'default',
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'bad' | 'accent';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const colorMap: Record<string, string> = {
    default: 'text-gray-100',
    good: 'text-emerald-400',
    bad: 'text-rose-400',
    accent: 'text-violet-400',
  };
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </div>
        <p className={`text-2xl font-semibold ${colorMap[tone]}`}>{value}</p>
        {hint && <p className="text-[11px] text-gray-500 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function BusinessPlanPage() {
  const [s, setS] = useState<Scenario>(PRESETS.base);
  const [activePreset, setActivePreset] = useState<string>('base');

  const setField = <K extends keyof Scenario>(k: K, v: Scenario[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setActivePreset('custom');
  };

  const applyPreset = (name: string) => {
    setS({ ...PRESETS[name] });
    setActivePreset(name);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const llmAUD = s.llmCostUSD * s.fxRate;
  const teleAUD = s.telephonyCostUSD * s.fxRate;
  const variableCostPerMin = llmAUD + teleAUD;
  const overageMins = Math.max(0, s.avgMinutesPerMonth - s.includedMinutes);
  const monthlyRevPerCust = s.monthlyFee + overageMins * s.overageRate;
  const monthlyCogsPerCust = s.avgMinutesPerMonth * variableCostPerMin;
  const monthlyGpPerCust = monthlyRevPerCust - monthlyCogsPerCust;
  const grossMarginPct = monthlyRevPerCust > 0 ? monthlyGpPerCust / monthlyRevPerCust : 0;
  const marginPerMin =
    s.avgMinutesPerMonth > 0
      ? (s.overageRate - variableCostPerMin) // pure overage minute margin
      : 0;
  const overageMarginPct = s.overageRate > 0 ? marginPerMin / s.overageRate : 0;

  const ltv = s.setupFee + monthlyGpPerCust * s.tenureMonths;

  // Year 1 blended CAC (marketing + outbound proxy from other opex slice — keep simple: marketing only)
  const year1Marketing = s.marketingPerMonth.slice(0, 4).reduce((a, b) => a + b * 3, 0);
  const year1NewCust = s.newCustomersPerMonth.slice(0, 4).reduce((a, b) => a + b * 3, 0);
  const cacFromMarketing = year1NewCust > 0 ? year1Marketing / year1NewCust : 0;

  const projection = useMemo(() => project(s, 36), [s]);
  const annual = useMemo(() => annualize(projection), [projection]);

  const ebitdaPositive = projection.find((r) => r.ebitda > 0);
  const minCash = projection.reduce((m, r) => Math.min(m, r.cumulativeCash), s.startingCash);
  const finalCash = projection[projection.length - 1]?.cumulativeCash ?? 0;

  // CAC payback (using marketing-only blended CAC)
  const netCAC = Math.max(0, cacFromMarketing - s.setupFee);
  const cacPayback = monthlyGpPerCust > 0 ? netCAC / monthlyGpPerCust : Infinity;
  const ltvCacRatio = cacFromMarketing > 0 ? ltv / cacFromMarketing : Infinity;

  // Per-minute cost waterfall data
  const costWaterfall = [
    { name: 'LLM', value: llmAUD, color: '#8b5cf6' },
    { name: 'Telephony', value: teleAUD, color: '#06b6d4' },
    { name: 'Margin', value: Math.max(0, s.overageRate - variableCostPerMin), color: '#10b981' },
  ];

  // Cohort retention sensitivity
  const tenureSensitivity = [8, 10, 12, 14, 18].map((t) => {
    const ltvAtT = s.setupFee + monthlyGpPerCust * t;
    return {
      tenure: `${t} mo`,
      ltv: ltvAtT,
      ratio: cacFromMarketing > 0 ? ltvAtT / cacFromMarketing : 0,
    };
  });

  // Active customers chart data
  const activeCustData = projection.map((r) => ({
    month: r.month,
    label: `M${r.month}`,
    new: r.newCust,
    active: r.activeCust,
  }));

  const cashChartData = projection.map((r) => ({
    label: `M${r.month}`,
    month: r.month,
    cash: r.cumulativeCash,
    ebitda: r.ebitda,
  }));

  const revVsCostData = projection.map((r) => ({
    label: `M${r.month}`,
    month: r.month,
    revenue: r.totalRev,
    costs: r.totalCosts,
  }));

  const annualBarData = annual.map((y) => ({
    year: `Year ${y.year}`,
    Revenue: y.totalRev,
    GrossProfit: y.totalRev - y.variableCogs - y.gpuLease,
    EBITDA: y.ebitda,
  }));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-xs text-violet-400 font-medium tracking-widest uppercase">
            Investor Business Plan · Live Model
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-100 mt-1">
            Pricing, Unit Economics & Break-even Projection
          </h1>
          <p className="text-sm text-gray-400 mt-1.5 max-w-3xl">
            Interactive companion to the May 2026 Investor Pack. Edit pricing, cost stack,
            acquisition curves and OpEx — every chart and metric below recomputes live. Defaults
            mirror the base case in the document.
          </p>
        </div>
        <button
          onClick={() => applyPreset('base')}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-md border border-gray-700 hover:border-gray-500 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to base case
        </button>
      </div>

      {/* Scenario presets */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'base', label: 'Base (current API stack)', icon: Target },
          { key: 'postRaise', label: 'Post-raise (AU GPU)', icon: Cpu },
          { key: 'bull', label: 'Bull (18-mo tenure)', icon: TrendingUp },
          { key: 'bear', label: 'Bear (8-mo tenure)', icon: AlertTriangle },
          { key: 'minRaise', label: 'Minimum raise ($500K)', icon: DollarSign },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => applyPreset(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              activePreset === key
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        {activePreset === 'custom' && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30">
            <Info className="w-3.5 h-3.5" />
            Custom scenario
          </span>
        )}
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat
          label="Gross margin / min"
          value={fmtPct(overageMarginPct, 0)}
          hint={`${fmtAUD2(s.overageRate - variableCostPerMin)} of ${fmtAUD2(s.overageRate)}`}
          tone="good"
          icon={Phone}
        />
        <Stat
          label="LTV (per customer)"
          value={fmtAUD0(ltv)}
          hint={`${s.tenureMonths}-mo tenure × $${monthlyGpPerCust.toFixed(0)} GP`}
          tone="accent"
          icon={Users}
        />
        <Stat
          label="Blended CAC (paid)"
          value={fmtAUD0(cacFromMarketing)}
          hint={`Y1 marketing $${(year1Marketing / 1000).toFixed(0)}K ÷ ${year1NewCust}`}
          icon={Target}
        />
        <Stat
          label="LTV : CAC"
          value={`${ltvCacRatio.toFixed(1)}x`}
          hint={ltvCacRatio >= 3 ? 'Healthy SaaS (≥ 3x)' : 'Below 3x threshold'}
          tone={ltvCacRatio >= 3 ? 'good' : 'bad'}
        />
        <Stat
          label="CAC payback"
          value={Number.isFinite(cacPayback) ? `${cacPayback.toFixed(1)} mo` : '—'}
          hint={`Net of $${s.setupFee} setup`}
          tone={cacPayback < 6 ? 'good' : 'bad'}
        />
        <Stat
          label="Cash break-even"
          value={ebitdaPositive ? `Month ${ebitdaPositive.month}` : 'Not in 36 mo'}
          hint={ebitdaPositive ? `${ebitdaPositive.yearLabel} Q${ebitdaPositive.quarter}` : 'Outside model window'}
          tone={ebitdaPositive ? 'good' : 'bad'}
          icon={Zap}
        />
      </div>

      {/* Inputs panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pricing & cost stack */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-gray-200">
              <Calculator className="w-4 h-4 text-violet-400" />
              Pricing & Offer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Setup fee (one-time)" value={s.setupFee} onChange={(v) => setField('setupFee', v)} prefix="$" />
              <NumField label="Monthly platform fee" value={s.monthlyFee} onChange={(v) => setField('monthlyFee', v)} prefix="$" />
              <NumField label="Included minutes / month" value={s.includedMinutes} onChange={(v) => setField('includedMinutes', v)} step={50} />
              <NumField label="Overage rate / min" value={s.overageRate} onChange={(v) => setField('overageRate', v)} prefix="$" step={0.01} decimals={2} />
              <NumField label="Avg minutes used / customer" value={s.avgMinutesPerMonth} onChange={(v) => setField('avgMinutesPerMonth', v)} step={50} />
              <NumField label="Average tenure (months)" value={s.tenureMonths} onChange={(v) => setField('tenureMonths', v)} />
            </div>
            <div className="text-xs text-gray-500 pt-1 border-t border-gray-800">
              Typical bill at {s.avgMinutesPerMonth} min:{' '}
              <span className="text-gray-200 font-medium">{fmtAUD0(monthlyRevPerCust)}/mo</span> · Monthly GP{' '}
              <span className="text-emerald-400 font-medium">{fmtAUD0(monthlyGpPerCust)}</span> ({fmtPct(grossMarginPct, 0)})
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-gray-200">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Cost Stack (per minute)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <NumField label="LLM inference (USD/min)" value={s.llmCostUSD} onChange={(v) => setField('llmCostUSD', v)} prefix="$" step={0.005} decimals={3} />
              <NumField label="Telephony (USD/min)" value={s.telephonyCostUSD} onChange={(v) => setField('telephonyCostUSD', v)} prefix="$" step={0.005} decimals={3} />
              <NumField label="USD → AUD FX" value={s.fxRate} onChange={(v) => setField('fxRate', v)} step={0.01} decimals={2} />
              <NumField label="AU GPU lease / month (AUD)" value={s.monthlyGPULease} onChange={(v) => setField('monthlyGPULease', v)} prefix="$" step={500} />
            </div>
            <div className="text-xs text-gray-500 pt-1 border-t border-gray-800 space-y-0.5">
              <div>
                Variable COGS: <span className="text-gray-200 font-medium">{fmtAUD2(variableCostPerMin)}/min</span>
              </div>
              <div>
                LLM <span className="text-violet-300">{fmtAUD2(llmAUD)}</span> + Telephony{' '}
                <span className="text-cyan-300">{fmtAUD2(teleAUD)}</span> = {fmtAUD2(variableCostPerMin)} ·{' '}
                Margin per overage min{' '}
                <span className="text-emerald-400 font-medium">{fmtAUD2(s.overageRate - variableCostPerMin)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acquisition & marketing */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-gray-200">
              <Users className="w-4 h-4 text-emerald-400" />
              Customer Acquisition (per month, by quarter)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ArrayField
              label="New customers / month"
              values={s.newCustomersPerMonth}
              onChange={(v) => setField('newCustomersPerMonth', v)}
            />
            <div className="text-xs text-gray-500 grid grid-cols-3 gap-2 pt-1 border-t border-gray-800">
              <div>
                <p className="text-gray-600">Year 1 total</p>
                <p className="text-gray-200 font-medium">{fmtNum(s.newCustomersPerMonth.slice(0, 4).reduce((a, b) => a + b * 3, 0))} customers</p>
              </div>
              <div>
                <p className="text-gray-600">Year 2 total</p>
                <p className="text-gray-200 font-medium">{fmtNum(s.newCustomersPerMonth.slice(4, 8).reduce((a, b) => a + b * 3, 0))} customers</p>
              </div>
              <div>
                <p className="text-gray-600">Year 3 total</p>
                <p className="text-gray-200 font-medium">{fmtNum(s.newCustomersPerMonth.slice(8, 12).reduce((a, b) => a + b * 3, 0))} customers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-gray-200">
              <DollarSign className="w-4 h-4 text-amber-400" />
              Marketing & OpEx (per month, by quarter)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ArrayField
              label="Paid marketing / month (AUD)"
              values={s.marketingPerMonth}
              onChange={(v) => setField('marketingPerMonth', v)}
              step={100}
            />
            <ArrayField
              label="Salaries & overhead / month (AUD) — fixed costs only"
              values={s.otherOpexPerMonth}
              onChange={(v) => setField('otherOpexPerMonth', v)}
              step={500}
            />
            <p className="text-[11px] text-gray-500 -mt-2">
              Founders + team payroll + tooling/SaaS + admin. Usage costs are handled separately as variable COGS
              above; marketing is the line above this one. Default ramps from ~$20K today to a $30K cap.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-800">
              <NumField label="Starting cash (AUD)" value={s.startingCash} onChange={(v) => setField('startingCash', v)} prefix="$" step={5000} />
              <NumField label="Seed raise injection (AUD)" value={s.seedRaise} onChange={(v) => setField('seedRaise', v)} prefix="$" step={50000} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-minute cost breakdown chart + per-customer P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-200">Cost per minute breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costWaterfall} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <XAxis type="number" stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={70} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                  formatter={(v) => fmtAUD2(Number(v ?? 0))}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {costWaterfall.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-gray-500 mt-2">
              Customer pays <span className="text-gray-300">{fmtAUD2(s.overageRate)}/min</span> for overage. Margin shown
              is the residual after variable COGS.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-200">Per-customer 12-month P&amp;L (base case)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              {[
                { label: 'Setup fee', amount: s.setupFee, pct: s.setupFee / (s.setupFee + monthlyRevPerCust * 12) },
                { label: `Subscription + overage (12 × ${fmtAUD0(monthlyRevPerCust)})`, amount: monthlyRevPerCust * 12, pct: (monthlyRevPerCust * 12) / (s.setupFee + monthlyRevPerCust * 12) },
                { label: 'Total revenue / customer', amount: s.setupFee + monthlyRevPerCust * 12, pct: 1, bold: true },
                { label: `Variable COGS (12 × ${fmtAUD0(monthlyCogsPerCust)})`, amount: -monthlyCogsPerCust * 12, pct: -(monthlyCogsPerCust * 12) / (s.setupFee + monthlyRevPerCust * 12), neg: true },
                { label: 'Gross profit / customer', amount: s.setupFee + monthlyGpPerCust * 12, pct: (s.setupFee + monthlyGpPerCust * 12) / (s.setupFee + monthlyRevPerCust * 12), bold: true, good: true },
                { label: 'Customer acquisition cost', amount: -cacFromMarketing, pct: -cacFromMarketing / (s.setupFee + monthlyRevPerCust * 12), neg: true },
                { label: 'Customer-level contribution', amount: s.setupFee + monthlyGpPerCust * 12 - cacFromMarketing, pct: (s.setupFee + monthlyGpPerCust * 12 - cacFromMarketing) / (s.setupFee + monthlyRevPerCust * 12), bold: true, good: true },
              ].map((row, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between py-1.5 px-2 rounded ${
                    row.bold ? 'bg-gray-950/60 border-l-2 ' + (row.good ? 'border-emerald-500' : 'border-gray-600') : ''
                  }`}
                >
                  <span className={`${row.bold ? 'font-medium text-gray-200' : 'text-gray-400'}`}>{row.label}</span>
                  <div className="flex items-center gap-3">
                    <span className={`tabular-nums ${row.neg ? 'text-rose-400' : row.good ? 'text-emerald-400' : 'text-gray-200'} ${row.bold ? 'font-semibold' : ''}`}>
                      {fmtAUD0(row.amount)}
                    </span>
                    <span className="text-[11px] text-gray-500 w-12 text-right tabular-nums">
                      {fmtPct(row.pct, 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cumulative cash + break-even */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between text-gray-200">
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Cumulative cash & break-even projection
            </span>
            <span className="text-xs font-normal text-gray-400">
              Min cash: <span className="text-rose-300">{fmtAUD0(minCash)}</span> · End-of-Y3:{' '}
              <span className={finalCash >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fmtAUD0(finalCash)}</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={cashChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="month"
                stroke="#6b7280"
                fontSize={11}
                ticks={[1, 6, 12, 18, 24, 30, 36]}
                tickFormatter={(m) => `M${m}`}
              />
              <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                labelFormatter={(m) => `Month ${m}`}
                formatter={(v) => fmtAUD0(Number(v ?? 0))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="cash"
                name="Cumulative cash"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="ebitda"
                name="Monthly EBITDA"
                stroke="#a78bfa"
                strokeWidth={1.6}
                dot={false}
              />
              {ebitdaPositive && (
                <ReferenceDot
                  x={ebitdaPositive.month}
                  y={ebitdaPositive.cumulativeCash}
                  r={5}
                  fill="#10b981"
                  stroke="#fff"
                  strokeWidth={1.5}
                  label={{ value: 'EBITDA+', position: 'top', fill: '#10b981', fontSize: 11 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          {ebitdaPositive ? (
            <p className="text-xs text-gray-400 mt-2">
              Monthly EBITDA turns positive in <span className="text-emerald-400 font-medium">month {ebitdaPositive.month}</span>{' '}
              ({ebitdaPositive.yearLabel} Q{ebitdaPositive.quarter}). The lowest cash trough during the ramp is{' '}
              <span className="text-rose-300 font-medium">{fmtAUD0(minCash)}</span> — that is the minimum capital this
              plan requires assuming the seed raise lands as scheduled.
            </p>
          ) : (
            <p className="text-xs text-amber-300 mt-2">
              EBITDA does not turn positive within the 36-month window. Increase pricing, reduce CAC, or extend tenure.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Revenue vs costs + active customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-200">Monthly revenue vs total costs</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={revVsCostData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={11} ticks={[1, 6, 12, 18, 24, 30, 36]} tickFormatter={(m) => `M${m}`} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(m) => `Month ${m}`}
                  formatter={(v) => fmtAUD0(Number(v ?? 0))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.18} />
                <Area type="monotone" dataKey="costs" name="Total costs" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.15} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-200">Active customers ramp</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={activeCustData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" stroke="#6b7280" fontSize={11} ticks={[1, 6, 12, 18, 24, 30, 36]} tickFormatter={(m) => `M${m}`} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(m) => `Month ${m}`}
                  formatter={(v) => fmtNum(Number(v ?? 0))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="new" name="New customers" fill="#8b5cf6" />
                <Line type="monotone" dataKey="active" name="Active (cohort-decayed)" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Annual P&L */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-gray-200">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            3-Year P&amp;L roll-up
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={annualBarData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6, fontSize: 12 }}
                formatter={(v) => fmtAUD0(Number(v ?? 0))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="GrossProfit" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="EBITDA" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left py-2 font-medium">Line item (AUD)</th>
                  {annual.map((y) => (
                    <th key={y.year} className="text-right py-2 font-medium">Year {y.year}</th>
                  ))}
                  <th className="text-right py-2 font-medium">3-Yr Total</th>
                </tr>
              </thead>
              <tbody className="text-gray-300 tabular-nums">
                {[
                  { label: 'New customers acquired', get: (y: YearSummary) => y.newCust, fmt: fmtNum },
                  { label: 'Active customers (year-end)', get: (y: YearSummary) => y.yearEndActive, fmt: (n: number) => fmtNum(n) },
                  { label: 'Setup fee revenue', get: (y: YearSummary) => y.setupRev, fmt: fmtAUD0 },
                  { label: 'Subscription revenue', get: (y: YearSummary) => y.subRev, fmt: fmtAUD0 },
                  { label: 'Total revenue', get: (y: YearSummary) => y.totalRev, fmt: fmtAUD0, bold: true },
                  { label: 'Variable COGS', get: (y: YearSummary) => -y.variableCogs, fmt: fmtAUD0, neg: true },
                  { label: 'GPU compute lease', get: (y: YearSummary) => -y.gpuLease, fmt: fmtAUD0, neg: true },
                  { label: 'Gross margin %', get: (y: YearSummary) => y.grossMargin, fmt: (n: number) => fmtPct(n, 0) },
                  { label: 'Marketing spend', get: (y: YearSummary) => -y.marketing, fmt: fmtAUD0, neg: true },
                  { label: 'Other OpEx', get: (y: YearSummary) => -y.otherOpex, fmt: fmtAUD0, neg: true },
                  { label: 'EBITDA', get: (y: YearSummary) => y.ebitda, fmt: fmtAUD0, bold: true, color: true },
                ].map((row, i) => {
                  const vals = annual.map((y) => row.get(y));
                  const total = row.label === 'Active customers (year-end)' || row.label === 'Gross margin %'
                    ? null
                    : vals.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={i} className={`border-b border-gray-800/50 ${row.bold ? 'font-semibold' : ''}`}>
                      <td className="py-1.5 text-gray-400">{row.label}</td>
                      {vals.map((v, j) => (
                        <td
                          key={j}
                          className={`text-right py-1.5 ${row.neg ? 'text-rose-300' : row.color ? (v >= 0 ? 'text-emerald-300' : 'text-rose-300') : 'text-gray-200'}`}
                        >
                          {row.fmt(v)}
                        </td>
                      ))}
                      <td className={`text-right py-1.5 ${row.neg ? 'text-rose-300' : row.color && total !== null ? (total >= 0 ? 'text-emerald-300' : 'text-rose-300') : 'text-gray-200'}`}>
                        {total === null ? '—' : row.fmt(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sensitivity & TAM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-200">Tenure sensitivity (LTV at current CAC)</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left py-1.5 font-medium">Avg tenure</th>
                  <th className="text-right py-1.5 font-medium">LTV (AUD)</th>
                  <th className="text-right py-1.5 font-medium">LTV : CAC</th>
                  <th className="text-right py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-gray-300 tabular-nums">
                {tenureSensitivity.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-800/50 ${row.tenure === `${s.tenureMonths} mo` ? 'bg-violet-500/10' : ''}`}
                  >
                    <td className="py-1.5 text-gray-400">{row.tenure}{row.tenure === `${s.tenureMonths} mo` && <span className="ml-2 text-violet-400">← current</span>}</td>
                    <td className="text-right py-1.5">{fmtAUD0(row.ltv)}</td>
                    <td className="text-right py-1.5">{row.ratio.toFixed(1)}x</td>
                    <td className={`text-right py-1.5 font-medium ${row.ratio >= 3 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.ratio >= 3 ? 'Healthy' : 'Below 3x'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-500 mt-2">
              The plan&rsquo;s base case assumes 12-month tenure. Even at the bear-case 8 months, LTV:CAC clears the
              3.0x SaaS health threshold provided CAC stays at or below current paid blended.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-gray-200">
              <Globe className="w-4 h-4 text-cyan-400" />
              Australian TAM / SAM / SOM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left py-1.5 font-medium">Vertical</th>
                  <th className="text-right py-1.5 font-medium">TAM</th>
                  <th className="text-right py-1.5 font-medium">SAM</th>
                  <th className="text-right py-1.5 font-medium">Y3 SOM</th>
                </tr>
              </thead>
              <tbody className="text-gray-300 tabular-nums">
                {[
                  { v: 'Healthcare', tam: '$642M', sam: '$45M', som: '$2.3–3.6M' },
                  { v: 'Debt collection', tam: '$30M', sam: '$9M', som: '$0.9–1.4M' },
                  { v: 'MSPs', tam: '$32M', sam: '$11M', som: '$0.6–1.1M' },
                  { v: 'Total', tam: '$704M', sam: '$65M', som: '$3.7–6.1M', bold: true },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-gray-800/50 ${row.bold ? 'font-semibold text-gray-100' : ''}`}>
                    <td className="py-1.5 text-gray-400">{row.v}</td>
                    <td className="text-right py-1.5">{row.tam}</td>
                    <td className="text-right py-1.5">{row.sam}</td>
                    <td className="text-right py-1.5">{row.som}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-500 mt-2">
              Year-3 SOM of $3.7–6.1M ARR requires no single vertical to exceed 10% market penetration. Source: ABS,
              IBISWorld 2025, AIHW 2026, BoldData 2025, CompTIA 2025.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      <div className="text-[11px] text-gray-500 border-t border-gray-800 pt-4 leading-relaxed space-y-1">
        <p>
          <span className="text-gray-400 font-medium">Model notes.</span> Active customer counts use exponential cohort
          decay derived from average tenure (monthly churn = 1 / tenure). Variable COGS treats LLM + telephony as the
          only per-minute costs; STT/TTS are bundled in the LLM voice API. Seed raise lands at month 1 by default.
        </p>
        <p>
          <span className="text-gray-400 font-medium">Cost structure.</span> Three independent cost levers: (1)
          variable COGS scales with usage (already separated above), (2) marketing is a discretionary growth budget,
          (3) salaries &amp; overhead is the fixed monthly run-rate. Defaults assume the lean operating reality —
          founders + small team capped at ~$30K/mo — not the post-raise hiring plan in the investor pack&rsquo;s P&amp;L
          (which assumed 5 sales hires, 2 senior engineers, dedicated CSM &amp; pushed OpEx toward $90–110K/mo).
        </p>
        <p>
          <span className="text-gray-400 font-medium">If you do raise the full $1.2M.</span> The investor pack&rsquo;s
          higher OpEx ramp can be modelled by editing the &ldquo;Salaries &amp; overhead&rdquo; quarterly cells upward
          to reflect each hire as it lands ({'~'}$8K/mo per sales hire, {'~'}$13K/mo per senior engineer, {'~'}$6K/mo
          per CSM), and toggling the GPU lease via the Post-raise preset.
        </p>
      </div>
    </div>
  );
}
