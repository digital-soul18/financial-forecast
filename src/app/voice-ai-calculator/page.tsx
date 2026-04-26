'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, FolderOpen, Trash2, X } from 'lucide-react';

// ── Saved estimate type ─────────────────────────────────────────────────────────

const LS_KEY = 'voiceai_calculator_estimates';

interface SavedEstimate {
  id: string;
  name: string;
  savedAt: string;
  params: Params;
}

function loadSaved(): SavedEstimate[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function persistSaved(estimates: SavedEstimate[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(estimates));
}

// ── Formatting helpers ──────────────────────────────────────────────────────────

const fmt = (n: number, d = 0) => n.toFixed(d);
const fmtAUD = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── GPU Configs ─────────────────────────────────────────────────────────────────

const CONFIGS = [
  {
    id: 'l40s',
    name: 'L40S Premium',
    type: 'optimal',
    gpuType: 'L40S',
    gpuCount: 6,
    gpuCostPerHour: 1.33,
    expectedLatency: 420,
    tokensPerSec: 28,
    maxSessions: 24,
    model: '',
    notes: 'Best L40S option',
    reliability: 0.97,
  },
  {
    id: 'h100-standard',
    name: 'H100 Standard',
    type: 'performance',
    gpuType: 'H100',
    gpuCount: 2,
    gpuCostPerHour: 3.05,
    expectedLatency: 350,
    tokensPerSec: 32,
    maxSessions: 18,
    model: '',
    notes: 'Premium performance',
    reliability: 0.98,
  },
  {
    id: 'h100-capacity',
    name: 'H100 High Capacity',
    type: 'performance',
    gpuType: 'H100',
    gpuCount: 4,
    gpuCostPerHour: 3.05,
    expectedLatency: 290,
    tokensPerSec: 45,
    maxSessions: 30,
    model: '',
    notes: 'Future-proof scaling',
    reliability: 0.99,
  },
] as const;

type ConfigId = 'l40s' | 'h100-standard' | 'h100-capacity';
type SelectedGPU = 'all' | ConfigId;

// ── Params ──────────────────────────────────────────────────────────────────────

interface Params {
  sessions: number;
  totalClients: number;
  callsPerClientPerDay: number;
  hoursPerDay: number;
  daysPerMonth: number;
  h100Cost: number;
  l40Cost: number;
  revenuePerMinute: number;
  monthlyPlatformFee: number;
  avgSessionMinutes: number;
  engineerSalary: number;
  supportEngineers: number;
  supportStaffCost: number;
  customerServiceCost: number;
  overheadPercent: number;
  utilizationRate: number;
}

const DEFAULT_PARAMS: Params = {
  sessions: 15,
  totalClients: 50,
  callsPerClientPerDay: 30,
  hoursPerDay: 12,
  daysPerMonth: 22,
  h100Cost: 3.05,
  l40Cost: 1.33,
  revenuePerMinute: 0.3,
  monthlyPlatformFee: 300,
  avgSessionMinutes: 8,
  engineerSalary: 12000,
  supportEngineers: 1,
  supportStaffCost: 1667,
  customerServiceCost: 1250,
  overheadPercent: 25,
  utilizationRate: 70,
};

const INPUT_DEFS: {
  key: keyof Params;
  label: string;
  step: number;
}[] = [
  { key: 'sessions', label: 'Max Concurrent Sessions', step: 1 },
  { key: 'totalClients', label: 'Total Clients', step: 1 },
  { key: 'callsPerClientPerDay', label: 'Calls per Client per Day', step: 0.1 },
  { key: 'revenuePerMinute', label: 'Revenue per Minute (AUD)', step: 0.01 },
  { key: 'daysPerMonth', label: 'Operating Days/Month', step: 1 },
  { key: 'h100Cost', label: 'H100 Cost (AUD/hr)', step: 0.01 },
  { key: 'l40Cost', label: 'L40S Cost (AUD/hr)', step: 0.01 },
  { key: 'hoursPerDay', label: 'Operating Hours/Day', step: 1 },
  { key: 'monthlyPlatformFee', label: 'Monthly Platform Fee per Client (AUD)', step: 1 },
  { key: 'avgSessionMinutes', label: 'Avg Session Length (min)', step: 1 },
  { key: 'engineerSalary', label: 'Engineer Salary (AUD/month)', step: 100 },
  { key: 'supportEngineers', label: 'Support Engineers (FTE)', step: 0.1 },
  { key: 'supportStaffCost', label: 'Support Staff Cost (AUD/month)', step: 100 },
  { key: 'customerServiceCost', label: 'Customer Service Cost (AUD/month)', step: 100 },
  { key: 'overheadPercent', label: 'Business Overhead (%)', step: 1 },
  { key: 'utilizationRate', label: 'Session Utilization Rate (%)', step: 1 },
];

// ── calculateMetrics ────────────────────────────────────────────────────────────

interface Config {
  id: string;
  name: string;
  type: string;
  gpuType: string;
  gpuCount: number;
  gpuCostPerHour: number;
  expectedLatency: number;
  tokensPerSec: number;
  maxSessions: number;
  model: string;
  notes: string;
  reliability: number;
}

interface Metrics {
  scalingMultiplier: number;
  scaledMaxSessions: number;
  monthlyInfraCost: number;
  monthlySupportCost: number;
  totalStaffCosts: number;
  overheadCost: number;
  totalMonthlyCost: number;
  totalCallsPerMonth: number;
  servedCallsPerMonth: number;
  droppedCallsPerMonth: number;
  peakConcurrentDemand: number;
  capacityUtilization: number;
  canHandlePeakDemand: boolean;
  actualMinutesServed: number;
  platformFeeRevenue: number;
  callMinuteRevenue: number;
  monthlyRevenue: number;
  lostRevenue: number;
  monthlyProfit: number;
  profitMargin: number;
  breakEvenCalls: number;
  costPerCall: number;
  profitPerCall: number;
  annualRevenue: number;
  annualProfit: number;
}

function calculateMetrics(config: Config, params: Params): Metrics {
  const sessionBatches = Math.ceil(params.sessions / 15);
  const scalingMultiplier = sessionBatches;
  const hourlyGpuCost = config.gpuCostPerHour * config.gpuCount * scalingMultiplier;
  // Infrastructure cost: server runs hoursPerDay × daysPerMonth regardless of call volume
  const monthlyInfraCost = hourlyGpuCost * params.hoursPerDay * params.daysPerMonth;

  const scaledMaxSessions = config.maxSessions * scalingMultiplier;
  const maxConcurrentCapacity = Math.min(params.sessions, scaledMaxSessions);
  const effectiveCapacity = maxConcurrentCapacity * (params.utilizationRate / 100);

  // Revenue is driven purely by client demand — hoursPerDay does NOT affect call volume
  const totalCallsPerDay = params.totalClients * params.callsPerClientPerDay;
  const totalCallsPerMonth = totalCallsPerDay * params.daysPerMonth;
  const totalMinutesPerMonth = totalCallsPerMonth * params.avgSessionMinutes;

  // Peak concurrent demand: calls spread across operating hours (informational for capacity planning)
  const callsPerHour = params.hoursPerDay > 0 ? totalCallsPerDay / params.hoursPerDay : 0;
  const peakConcurrentDemand = callsPerHour * (params.avgSessionMinutes / 60);

  // Capacity constraint: if hardware can't handle peak, some calls are dropped
  const canHandlePeakDemand = effectiveCapacity >= peakConcurrentDemand;
  const servedCallsPerMonth = canHandlePeakDemand
    ? totalCallsPerMonth
    : effectiveCapacity > 0
    ? totalCallsPerMonth * (effectiveCapacity / peakConcurrentDemand)
    : 0;
  const droppedCallsPerMonth = Math.max(0, totalCallsPerMonth - servedCallsPerMonth);
  const actualMinutesServed = servedCallsPerMonth * params.avgSessionMinutes;
  const capacityUtilization =
    effectiveCapacity > 0
      ? Math.min(peakConcurrentDemand / effectiveCapacity, 1) * 100
      : 0;

  // Revenue based on calls actually served — NOT affected by hoursPerDay
  const platformFeeRevenue = params.totalClients * params.monthlyPlatformFee;
  const callMinuteRevenue = actualMinutesServed * params.revenuePerMinute;
  const monthlyRevenue = platformFeeRevenue + callMinuteRevenue;
  const lostRevenue =
    droppedCallsPerMonth * params.avgSessionMinutes * params.revenuePerMinute;
  void totalMinutesPerMonth; // available for display if needed

  const monthlySupportCost = params.supportEngineers * params.engineerSalary;
  const totalStaffCosts =
    monthlySupportCost + params.supportStaffCost + params.customerServiceCost;
  const overheadCost =
    (monthlyInfraCost + totalStaffCosts) * (params.overheadPercent / 100);
  const totalMonthlyCost = monthlyInfraCost + totalStaffCosts + overheadCost;

  const monthlyProfit = monthlyRevenue - totalMonthlyCost;
  const profitMargin =
    monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : -100;
  const breakEvenMinutes =
    params.revenuePerMinute > 0
      ? Math.ceil(totalMonthlyCost / params.revenuePerMinute)
      : 0;
  const breakEvenCalls =
    params.avgSessionMinutes > 0
      ? Math.ceil(breakEvenMinutes / params.avgSessionMinutes)
      : 0;
  const costPerMinute =
    actualMinutesServed > 0 ? totalMonthlyCost / actualMinutesServed : 0;
  const costPerCall = params.avgSessionMinutes * costPerMinute;
  const profitPerCall =
    params.avgSessionMinutes * params.revenuePerMinute - costPerCall;
  const annualRevenue = monthlyRevenue * 12;
  const annualProfit = monthlyProfit * 12;

  return {
    scalingMultiplier,
    scaledMaxSessions,
    monthlyInfraCost,
    monthlySupportCost,
    totalStaffCosts,
    overheadCost,
    totalMonthlyCost,
    totalCallsPerMonth,
    servedCallsPerMonth,
    droppedCallsPerMonth,
    peakConcurrentDemand,
    capacityUtilization,
    canHandlePeakDemand,
    actualMinutesServed,
    platformFeeRevenue,
    callMinuteRevenue,
    monthlyRevenue,
    lostRevenue,
    monthlyProfit,
    profitMargin,
    breakEvenCalls,
    costPerCall,
    profitPerCall,
    annualRevenue,
    annualProfit,
  };
}

// ── CalcInput — draft string prevents 0-prefix / ghost-zero issues ──────────────

function CalcInput({
  value,
  step,
  onChange,
}: {
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Sync when parent loads a saved estimate
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <input
      type="number"
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const n = parseFloat(draft);
          if (!isNaN(n)) {
            onChange(n);
            setDraft(String(n));
          } else {
            setDraft(String(value));
          }
          e.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const n = parseFloat(draft);
        if (!isNaN(n)) {
          onChange(n);
          setDraft(String(n));
        } else {
          // Restore last valid value
          setDraft(String(value));
        }
      }}
      className="bg-gray-800 border border-gray-700 text-gray-200 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
    />
  );
}

// ── Config card styles ──────────────────────────────────────────────────────────

function getConfigStyle(type: string, profitable: boolean) {
  if (!profitable) {
    return {
      border: 'border-l-4 border-l-red-500',
      badge: 'bg-red-600',
      label: 'Unprofitable',
    };
  }
  if (type === 'optimal') {
    return {
      border: 'border-l-4 border-l-emerald-500',
      badge: 'bg-emerald-600',
      label: 'Optimal',
    };
  }
  return {
    border: 'border-l-4 border-l-amber-500',
    badge: 'bg-amber-600',
    label: 'Performance',
  };
}

// ── Metric row ──────────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  formula,
  valueClass,
}: {
  label: string;
  value: string;
  formula?: string;
  valueClass?: string;
}) {
  return (
    <div className="py-1.5 border-b border-gray-800 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs">{label}</span>
        <span className={`text-sm font-medium ${valueClass ?? 'text-gray-200'}`}>
          {value}
        </span>
      </div>
      {formula && (
        <p className="text-[11px] text-gray-600 italic mt-0.5">{formula}</p>
      )}
    </div>
  );
}

// ── Custom tooltip ──────────────────────────────────────────────────────────────

function ProfitTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; profit: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isPositive = d.profit >= 0;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm">
      <p className="text-gray-300 font-medium mb-1">{d.name}</p>
      <p className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
        {isPositive ? '' : '-'}
        {fmtAUD(d.profit)} / month
      </p>
    </div>
  );
}

// ── Insights ────────────────────────────────────────────────────────────────────

function renderInsights(
  allResults: { config: (typeof CONFIGS)[number]; metrics: Metrics }[],
  params: Params,
) {
  const insights: string[] = [];
  const profitable = allResults.filter((r) => r.metrics.monthlyProfit > 0);
  const best =
    profitable.length > 0
      ? profitable.reduce((a, b) =>
          a.metrics.monthlyProfit > b.metrics.monthlyProfit ? a : b,
        )
      : null;

  if (best) {
    insights.push(
      `Best option is ${best.config.name} with ${fmtAUD(best.metrics.monthlyProfit)}/month profit (${fmt(best.metrics.profitMargin, 1)}% margin).`,
    );
  } else {
    insights.push(
      'No configuration is currently profitable. Consider increasing revenue per minute or reducing costs.',
    );
  }

  const dropped = allResults.filter((r) => r.metrics.droppedCallsPerMonth > 0);
  if (dropped.length > 0) {
    const worst = dropped.reduce((a, b) =>
      a.metrics.droppedCallsPerMonth > b.metrics.droppedCallsPerMonth ? a : b,
    );
    insights.push(
      `${worst.config.name} drops ${Math.round(worst.metrics.droppedCallsPerMonth).toLocaleString()} calls/month — ${fmtAUD(worst.metrics.lostRevenue)} in lost revenue.`,
    );
  } else {
    insights.push('All configurations can handle peak demand with current settings.');
  }

  const highUtil = allResults.filter((r) => r.metrics.capacityUtilization > 85);
  if (highUtil.length > 0) {
    insights.push(
      `${highUtil.map((r) => r.config.name).join(', ')} ${highUtil.length === 1 ? 'is' : 'are'} running above 85% utilization — consider scaling up sessions.`,
    );
  }

  const sessionBatches = Math.ceil(params.sessions / 15);
  if (sessionBatches > 1) {
    insights.push(
      `Running ${sessionBatches}× scaling batches for ${params.sessions} concurrent sessions — infrastructure costs scale linearly.`,
    );
  }

  if (params.utilizationRate < 60) {
    insights.push(
      `Utilization rate is ${params.utilizationRate}% — low utilization inflates cost-per-call. Consider reducing idle GPU time.`,
    );
  }

  if (params.revenuePerMinute < 0.2) {
    insights.push(
      'Revenue per minute is below $0.20 AUD — profitability is highly sensitive at this rate; small changes have a large impact.',
    );
  }

  return insights;
}

// ── Main page ───────────────────────────────────────────────────────────────────

export default function VoiceAICalculatorPage() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [selectedGPU, setSelectedGPU] = useState<SelectedGPU>('all');

  // ── Save / load state ────────────────────────────────────────────────────────
  const [savedEstimates, setSavedEstimates] = useState<SavedEstimate[]>([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);

  // Load from localStorage on mount (localStorage isn't available during SSR)
  useEffect(() => {
    setSavedEstimates(loadSaved());
  }, []);

  // Close load panel on outside click
  useEffect(() => {
    if (!showLoadPanel) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-load-panel]')) setShowLoadPanel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLoadPanel]);

  function saveEstimate() {
    if (!saveName.trim()) return;
    const existing = savedEstimates.find((e) => e.id === activeEstimateId);
    let updated: SavedEstimate[];
    if (existing) {
      // Update in place
      updated = savedEstimates.map((e) =>
        e.id === activeEstimateId ? { ...e, name: saveName.trim(), savedAt: new Date().toISOString(), params } : e,
      );
    } else {
      // Create new
      const newEstimate: SavedEstimate = {
        id: crypto.randomUUID(),
        name: saveName.trim(),
        savedAt: new Date().toISOString(),
        params,
      };
      updated = [newEstimate, ...savedEstimates];
      setActiveEstimateId(newEstimate.id);
    }
    persistSaved(updated);
    setSavedEstimates(updated);
    setShowSaveInput(false);
    setSaveName('');
  }

  function loadEstimate(estimate: SavedEstimate) {
    setParams(estimate.params);
    setActiveEstimateId(estimate.id);
    setSaveName(estimate.name);
    setShowLoadPanel(false);
  }

  function deleteEstimate(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = savedEstimates.filter((e) => e.id !== id);
    persistSaved(updated);
    setSavedEstimates(updated);
    if (activeEstimateId === id) {
      setActiveEstimateId(null);
      setSaveName('');
    }
  }

  function handleSaveClick() {
    if (activeEstimateId) {
      // Save directly to active estimate
      const updated = savedEstimates.map((e) =>
        e.id === activeEstimateId ? { ...e, savedAt: new Date().toISOString(), params } : e,
      );
      persistSaved(updated);
      setSavedEstimates(updated);
    } else {
      setShowSaveInput(true);
    }
  }

  function setParam(key: keyof Params, value: number) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  const allResults = useMemo(
    () =>
      CONFIGS.map((config) => ({
        config,
        metrics: calculateMetrics(config, params),
      })),
    [params],
  );

  const visibleResults = useMemo(
    () =>
      selectedGPU === 'all'
        ? allResults
        : allResults.filter((r) => r.config.id === selectedGPU),
    [allResults, selectedGPU],
  );

  const bestResult = useMemo(() => {
    const profitable = allResults.filter((r) => r.metrics.monthlyProfit > 0);
    return profitable.length > 0
      ? profitable.reduce((a, b) =>
          a.metrics.monthlyProfit > b.metrics.monthlyProfit ? a : b,
        )
      : allResults[0];
  }, [allResults]);

  const chartData = useMemo(
    () =>
      allResults.map((r) => ({
        name: r.config.name,
        profit: Math.round(r.metrics.monthlyProfit),
        id: r.config.id,
      })),
    [allResults],
  );

  const insights = useMemo(
    () => renderInsights(allResults, params),
    [allResults, params],
  );

  const gpuFilterButtons: { id: SelectedGPU; label: string }[] = [
    { id: 'all', label: 'Show All' },
    { id: 'l40s', label: 'L40S Premium' },
    { id: 'h100-standard', label: 'H100 Standard' },
    { id: 'h100-capacity', label: 'H100 High Capacity' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page heading */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 tracking-tight">
            Voice AI Cost Calculator
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {activeEstimateId
              ? `Editing: ${savedEstimates.find((e) => e.id === activeEstimateId)?.name ?? ''}`
              : 'Model GPU infrastructure costs, revenue, and profitability across configurations.'}
          </p>
        </div>

        {/* Save / Load controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Load dropdown */}
          <div className="relative" data-load-panel>
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
              onClick={() => setShowLoadPanel((p) => !p)}
              title="Load a saved estimate"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {savedEstimates.length > 0 ? `Saved (${savedEstimates.length})` : 'Saved'}
            </button>
            {showLoadPanel && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] bg-gray-800 border border-gray-700 rounded shadow-xl">
                {savedEstimates.length === 0 ? (
                  <p className="text-xs text-gray-500 px-3 py-2">No saved estimates yet</p>
                ) : (
                  savedEstimates.map((est) => (
                    <div
                      key={est.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-700 cursor-pointer group ${activeEstimateId === est.id ? 'bg-violet-900/30' : ''}`}
                      onClick={() => loadEstimate(est)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-200 truncate">{est.name}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(est.savedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <button
                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => deleteEstimate(est.id, e)}
                        title="Delete estimate"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Save / Save as */}
          {showSaveInput ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                className="w-36 bg-gray-800 border border-violet-500 text-gray-100 text-xs px-2 py-1.5 rounded outline-none"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEstimate();
                  if (e.key === 'Escape') { setShowSaveInput(false); setSaveName(''); }
                }}
                placeholder="Estimate name…"
              />
              <button
                className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded transition-colors disabled:opacity-50"
                onClick={saveEstimate}
                disabled={!saveName.trim()}
              >
                Save
              </button>
              <button
                className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded"
                onClick={() => { setShowSaveInput(false); setSaveName(''); }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-violet-900/40 hover:bg-violet-800/50 text-violet-300 rounded border border-violet-800 transition-colors"
              onClick={handleSaveClick}
              title={activeEstimateId ? 'Save changes to this estimate' : 'Save as new estimate'}
            >
              <Save className="w-3.5 h-3.5" />
              {activeEstimateId ? 'Save' : 'Save as…'}
            </button>
          )}

          {/* New / reset */}
          {activeEstimateId && (
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded border border-gray-700 transition-colors"
              onClick={() => { setParams(DEFAULT_PARAMS); setActiveEstimateId(null); setSaveName(''); }}
              title="Start a new blank estimate"
            >
              New
            </button>
          )}
        </div>
      </div>

      {/* ── Inputs card ── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-gray-100 text-base">Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {INPUT_DEFS.map(({ key, label, step }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-gray-400 font-medium leading-tight">
                  {label}
                </label>
                <CalcInput
                  value={params[key]}
                  step={step}
                  onChange={(v) => setParam(key, v)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Monthly Revenue',
            value: bestResult.metrics.monthlyRevenue,
            format: (v: number) => fmtAUD(v),
            alwaysGreen: true,
          },
          {
            label: 'Monthly Profit',
            value: bestResult.metrics.monthlyProfit,
            format: (v: number) => (v < 0 ? `-${fmtAUD(v)}` : fmtAUD(v)),
            alwaysGreen: false,
          },
          {
            label: 'Annual Profit',
            value: bestResult.metrics.annualProfit,
            format: (v: number) => (v < 0 ? `-${fmtAUD(v)}` : fmtAUD(v)),
            alwaysGreen: false,
          },
          {
            label: 'Profit Margin',
            value: bestResult.metrics.profitMargin,
            format: (v: number) => `${fmt(v, 1)}%`,
            alwaysGreen: false,
          },
        ].map(({ label, value, format, alwaysGreen }) => {
          const isPositive = value >= 0;
          const colorClass = alwaysGreen
            ? 'text-emerald-400'
            : isPositive
            ? 'text-emerald-400'
            : 'text-red-400';
          return (
            <Card key={label} className="bg-gray-900 border-gray-800">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className={`text-xl font-bold ${colorClass}`}>
                  {format(value)}
                </p>
                <p className="text-[11px] text-gray-600 mt-1">
                  Best: {bestResult.config.name}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── GPU filter tabs ── */}
      <div className="flex flex-wrap gap-2">
        {gpuFilterButtons.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSelectedGPU(id)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              selectedGPU === id
                ? 'bg-violet-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Config cards ── */}
      <div
        className={`grid gap-4 ${
          visibleResults.length === 1
            ? 'grid-cols-1 max-w-xl'
            : visibleResults.length === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        }`}
      >
        {visibleResults.map(({ config, metrics }) => {
          const style = getConfigStyle(config.type, metrics.monthlyProfit >= 0);
          return (
            <Card
              key={config.id}
              className={`bg-gray-900 border-gray-800 ${style.border}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-gray-100 text-base">
                      {config.name}
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {config.gpuCount}× {config.gpuType}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded text-white ${style.badge} shrink-0`}
                  >
                    {style.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 italic">{config.notes}</p>
              </CardHeader>
              <CardContent className="pt-0 space-y-0">
                <MetricRow
                  label="Hardware"
                  value={`${config.gpuCount}× ${config.gpuType} (${metrics.scalingMultiplier}× batch)`}
                  formula={`ceil(${params.sessions} sessions / 15) = ${metrics.scalingMultiplier}× scaling`}
                />
                <MetricRow
                  label="Latency"
                  value={`${config.expectedLatency} ms`}
                  formula={`${config.tokensPerSec} tok/s · ${config.reliability * 100}% reliability`}
                />
                <MetricRow
                  label="Peak Concurrent Demand"
                  value={fmt(metrics.peakConcurrentDemand, 1)}
                  formula={`(${params.totalClients} clients × ${params.callsPerClientPerDay} calls/day ÷ ${params.hoursPerDay} hr) × (${params.avgSessionMinutes} min ÷ 60)`}
                />
                <MetricRow
                  label="Capacity Utilization"
                  value={`${fmt(metrics.capacityUtilization, 1)}%`}
                  formula={`Peak demand / effective capacity × 100`}
                />
                <MetricRow
                  label="Total Calls / Month"
                  value={Math.round(metrics.totalCallsPerMonth).toLocaleString()}
                  formula={`${params.totalClients} clients × ${params.callsPerClientPerDay} calls/day × ${params.daysPerMonth} days`}
                />
                <MetricRow
                  label="Served Calls / Month"
                  value={Math.round(metrics.servedCallsPerMonth).toLocaleString()}
                  valueClass={
                    metrics.canHandlePeakDemand ? 'text-emerald-400' : 'text-amber-400'
                  }
                  formula={
                    metrics.canHandlePeakDemand
                      ? 'All calls served (capacity sufficient)'
                      : `Partial: total × (capacity / demand)`
                  }
                />
                {metrics.droppedCallsPerMonth > 0 && (
                  <MetricRow
                    label="Dropped Calls / Month"
                    value={Math.round(metrics.droppedCallsPerMonth).toLocaleString()}
                    valueClass="text-red-400"
                    formula={`Lost revenue: ${fmtAUD(metrics.lostRevenue)}`}
                  />
                )}
                <MetricRow
                  label="Minutes Served"
                  value={Math.round(metrics.actualMinutesServed).toLocaleString()}
                  formula={`Served calls × ${params.avgSessionMinutes} min avg`}
                />

                <div className="pt-2 pb-1">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Revenue
                  </p>
                </div>
                <MetricRow
                  label="Platform Fee Revenue"
                  value={fmtAUD(metrics.platformFeeRevenue)}
                  formula={`${params.totalClients} clients × ${fmtAUD(params.monthlyPlatformFee)}/client`}
                />
                <MetricRow
                  label="Call Minute Revenue"
                  value={fmtAUD(metrics.callMinuteRevenue)}
                  formula={`${Math.round(metrics.actualMinutesServed).toLocaleString()} min × $${params.revenuePerMinute}/min`}
                />
                <MetricRow
                  label="Monthly Revenue"
                  value={fmtAUD(metrics.monthlyRevenue)}
                  valueClass="text-gray-100 font-semibold"
                />

                <div className="pt-2 pb-1">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Costs
                  </p>
                </div>
                <MetricRow
                  label="Infra Cost"
                  value={fmtAUD(metrics.monthlyInfraCost)}
                  formula={`${config.gpuCount}× GPU × $${config.gpuCostPerHour}/hr × ${metrics.scalingMultiplier}× × ${params.hoursPerDay} hr × ${params.daysPerMonth} days`}
                />
                <MetricRow
                  label="Staff Cost"
                  value={fmtAUD(metrics.totalStaffCosts)}
                  formula={`Engineers + support staff + customer service`}
                />
                <MetricRow
                  label="Overhead"
                  value={fmtAUD(metrics.overheadCost)}
                  formula={`${params.overheadPercent}% of (infra + staff)`}
                />
                <MetricRow
                  label="Total Monthly Cost"
                  value={fmtAUD(metrics.totalMonthlyCost)}
                  valueClass="text-gray-100 font-semibold"
                />

                <div className="pt-3 pb-2 border-t border-gray-800 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 font-semibold">
                      Monthly Profit
                    </span>
                    <span
                      className={`text-xl font-bold ${
                        metrics.monthlyProfit >= 0
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {metrics.monthlyProfit < 0 ? '-' : ''}
                      {fmtAUD(metrics.monthlyProfit)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 text-right mt-0.5">
                    {fmt(metrics.profitMargin, 1)}% margin
                  </p>
                </div>

                <MetricRow
                  label="Break-even Calls"
                  value={metrics.breakEvenCalls.toLocaleString()}
                  formula={`ceil(total cost ÷ revenue per call)`}
                />
                <MetricRow
                  label="Cost per Call"
                  value={`$${fmt(metrics.costPerCall, 2)}`}
                  formula={`Total cost ÷ served calls`}
                />
                <MetricRow
                  label="Profit per Call"
                  value={`$${fmt(metrics.profitPerCall, 2)}`}
                  valueClass={
                    metrics.profitPerCall >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }
                  formula={`Revenue per call − cost per call`}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Profit chart ── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-gray-100 text-base">
            Monthly Profit by Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 0 ? `$${(v / 1000).toFixed(0)}k` : `-$${(Math.abs(v) / 1000).toFixed(0)}k`
                }
              />
              <Tooltip content={<ProfitTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend
                wrapperStyle={{ color: '#9ca3af', fontSize: 12, paddingTop: 8 }}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" />
              <Bar
                dataKey="profit"
                name="Monthly Profit (AUD)"
                radius={[3, 3, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.profit >= 0 ? '#10b981' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Business Insights ── */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-gray-100 text-base">Business Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-300">
                <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
