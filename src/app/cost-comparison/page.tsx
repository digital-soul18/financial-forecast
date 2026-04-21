'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { CheckCircle, XCircle, Minus } from 'lucide-react';

// ─── Controlled input that avoids the ghost-zero problem ──────────────────────
function CalcInput({
  label, value, onChange, prefix = '', suffix = '', step = 1, min = 0, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; step?: number; min?: number; hint?: string;
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400 font-medium leading-tight">{label}</label>
      <div className="flex items-center bg-gray-800 border border-gray-700 rounded-md px-3 py-2 gap-1 focus-within:border-violet-500 transition-colors">
        {prefix && <span className="text-gray-400 text-sm shrink-0">{prefix}</span>}
        <input
          type="number"
          step={step}
          min={min}
          value={focused ? draft : value}
          onFocus={() => { setDraft(value === 0 ? '' : String(value)); setFocused(true); }}
          onBlur={() => {
            const p = parseFloat(draft);
            onChange(isNaN(p) ? 0 : Math.max(min, p));
            setFocused(false); setDraft('');
          }}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="flex-1 bg-transparent text-white text-sm outline-none min-w-0"
        />
        {suffix && <span className="text-gray-400 text-sm shrink-0">{suffix}</span>}
      </div>
      {hint && <span className="text-[10px] text-gray-600 leading-tight">{hint}</span>}
    </div>
  );
}

// ─── Capability cell renderer ─────────────────────────────────────────────────
function CapCell({ val, positiveWhenTrue, colIdx }: {
  val: boolean | string; positiveWhenTrue?: boolean; colIdx: number;
}) {
  const colors = ['text-gray-300', 'text-gray-300', 'text-violet-300'];
  if (typeof val === 'boolean') {
    const good = positiveWhenTrue ? val : !val;
    return good
      ? <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
      : <XCircle className="w-4 h-4 text-red-400 mx-auto" />;
  }
  if (val === '—') return <Minus className="w-4 h-4 text-gray-600 mx-auto" />;
  return <span className={colors[colIdx]}>{val}</span>;
}

// ─── Number formatters ────────────────────────────────────────────────────────
const aud = (n: number, dec = 0) =>
  n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: dec, minimumFractionDigits: dec });

const k = (n: number) => n >= 1_000_000
  ? `$${(n / 1_000_000).toFixed(2)}M`
  : n >= 1000
    ? `$${(n / 1000).toFixed(0)}k`
    : aud(n);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CostComparisonPage() {
  // ── Configurable inputs ──────────────────────────────────────────────────
  const [callsPerDay, setCallsPerDay]           = useState(500);
  const [avgDuration, setAvgDuration]           = useState(3);
  const [localHourlyRate, setLocalHourlyRate]   = useState(28);
  const [offshoreHourlyRate, setOffshoreHourlyRate] = useState(8);
  const [aiCostPerMin, setAiCostPerMin]         = useState(0.45);
  const [gpuCostPerDay, setGpuCostPerDay]       = useState(70);
  const [bizDaysPerMonth, setBizDaysPerMonth]   = useState(22);

  // ── Derived: staffing ────────────────────────────────────────────────────
  const numAgents = Math.ceil(callsPerDay / 100); // each human handles ~100 calls/day

  // ── Local per-FTE cost breakdown (AUD/day) ───────────────────────────────
  const localBase      = localHourlyRate * 8;
  const localSuper     = localBase * 0.1116;   // ~11.16% superannuation
  const localLeave     = localBase * 0.1518;   // ~15% leave loading
  const localPayroll   = localBase * 0.0536;   // ~5.36% payroll tax/insurance
  const localOffice    = 25;
  const localEquip     = 5;
  const localMgr       = 20;
  const localRecruit   = 10;
  const localTraining  = 10;
  const localHR        = 8;
  const localTelephony = 20;
  const localPerFTE    = localBase + localSuper + localLeave + localPayroll +
    localOffice + localEquip + localMgr + localRecruit + localTraining + localHR + localTelephony;

  // ── Offshore per-FTE cost breakdown (AUD/day) ────────────────────────────
  const offBase       = offshoreHourlyRate * 8;
  const offAgency     = 40;
  const offMgr        = 30;
  const offRecruit    = 15;
  const offTraining   = 20;
  const offHR         = 10;
  const offTelephony  = 20;
  const offBPO        = 40; // BPO overhead / quality monitoring (reconciles PDF total to $239)
  const offshorePerFTE = offBase + offAgency + offMgr + offRecruit + offTraining + offHR + offTelephony + offBPO;

  // ── Daily totals ─────────────────────────────────────────────────────────
  const localDaily   = numAgents * localPerFTE;
  const offshoreDaily = numAgents * offshorePerFTE;
  const aiCallCost   = callsPerDay * avgDuration * aiCostPerMin;
  const aiDaily      = aiCallCost + gpuCostPerDay;

  // ── Per-call costs ───────────────────────────────────────────────────────
  const localCPC   = localDaily / callsPerDay;
  const offshoreCPC = offshoreDaily / callsPerDay;
  const aiCPC      = aiDaily / callsPerDay;

  // ── Monthly / annual ─────────────────────────────────────────────────────
  const localMonthly   = localDaily * bizDaysPerMonth;
  const offshoreMonthly = offshoreDaily * bizDaysPerMonth;
  const aiMonthly      = aiDaily * bizDaysPerMonth;

  const savVsLocal    = localMonthly - aiMonthly;
  const savVsOffshore = offshoreMonthly - aiMonthly;
  const annVsLocal    = savVsLocal * 12;
  const annVsOffshore = savVsOffshore * 12;

  // ── Chart data ───────────────────────────────────────────────────────────
  const dailyChart = [
    { name: '🇦🇺 Local', cost: Math.round(localDaily),    fill: '#ef4444' },
    { name: '🇵🇭 Offshore', cost: Math.round(offshoreDaily), fill: '#f97316' },
    { name: '🤖 AI Agent', cost: Math.round(aiDaily),    fill: '#8b5cf6' },
  ];

  const savingsChart = [
    { period: '1 Year',  vsLocal: Math.round(annVsLocal),     vsOffshore: Math.round(annVsOffshore) },
    { period: '2 Years', vsLocal: Math.round(annVsLocal * 2), vsOffshore: Math.round(annVsOffshore * 2) },
    { period: '5 Years', vsLocal: Math.round(annVsLocal * 5), vsOffshore: Math.round(annVsOffshore * 5) },
  ];

  // ── Line-item table rows ─────────────────────────────────────────────────
  const lineItems = [
    { cat: 'Base Wage (8 hrs)',         local: aud(localBase, 0),       offshore: aud(offBase, 0),    ai: `${aud(aiCostPerMin, 2)}/min × 24×7` },
    { cat: 'Super / Benefits',          local: aud(localSuper, 0),      offshore: 'In agency margin', ai: '$0' },
    { cat: 'Leave Loading',             local: aud(localLeave, 0),      offshore: 'Included',         ai: '$0' },
    { cat: 'Payroll Tax / Insurance',   local: aud(localPayroll, 0),    offshore: 'Included',         ai: '$0' },
    { cat: 'Agency Margin (BPO)',       local: '—',                     offshore: aud(offAgency, 0),  ai: '$0' },
    { cat: 'Office / BPO Seat',         local: aud(localOffice, 0),     offshore: 'Included',         ai: '$0' },
    { cat: 'Equipment',                 local: aud(localEquip, 0),      offshore: 'Included',         ai: '$0' },
    { cat: 'Manager Oversight',         local: aud(localMgr, 0),        offshore: aud(offMgr, 0),     ai: '$5' },
    { cat: 'Recruitment (amortised)',   local: aud(localRecruit, 0),    offshore: aud(offRecruit, 0), ai: '$0' },
    { cat: 'Training (amortised)',      local: aud(localTraining, 0),   offshore: aud(offTraining, 0),ai: '$20–$45 (setup)' },
    { cat: 'HR / Admin',                local: aud(localHR, 0),         offshore: aud(offHR, 0),      ai: '$0' },
    { cat: 'Telephony',                 local: aud(localTelephony, 0),  offshore: aud(offTelephony, 0), ai: 'Included' },
    { cat: 'BPO Overhead / QA',         local: '—',                     offshore: aud(offBPO, 0),     ai: '—' },
    { cat: 'GPU Infrastructure',        local: '—',                     offshore: '—',                ai: aud(gpuCostPerDay, 0) + '/day' },
    { cat: `AI Call Usage (${callsPerDay}×${avgDuration}min)`, local: '—', offshore: '—', ai: `${callsPerDay * avgDuration} min × ${aud(aiCostPerMin, 2)}` },
  ];

  // ── Capability rows ──────────────────────────────────────────────────────
  const capabilities: Array<{
    feature: string;
    local: boolean | string;
    offshore: boolean | string;
    ai: boolean | string;
    positiveWhenTrue?: boolean;
  }> = [
    { feature: 'Call Capacity / Day',    local: '~100',     offshore: '~100',              ai: 'Unlimited' },
    { feature: 'Concurrent Calls',       local: '1',        offshore: '1',                 ai: 'Unlimited' },
    { feature: 'After-Hours Coverage',   local: false,      offshore: 'Possible (shifts)', ai: '24 / 7',   positiveWhenTrue: true },
    { feature: 'Scales Instantly',       local: false,      offshore: false,               ai: true,        positiveWhenTrue: true },
    { feature: 'Fixed vs Variable Cost', local: 'Fixed',    offshore: 'Fixed',             ai: 'Usage-based' },
    { feature: 'Sick Leave Risk',        local: true,       offshore: true,                ai: false,       positiveWhenTrue: false },
    { feature: 'Churn Risk',             local: 'Moderate', offshore: 'High',              ai: 'None' },
    { feature: 'Hiring Complexity',      local: 'High',     offshore: 'High',              ai: 'None' },
    { feature: 'Accent / Brand Risk',    local: 'None',     offshore: 'Possible',          ai: 'Custom voice' },
    { feature: 'Data Sovereignty',       local: 'High',     offshore: 'Cross-border risk', ai: 'Optional on-prem' },
    { feature: 'Recruitment Cost',       local: '$3k–$5k',  offshore: '$1,500',            ai: '$0' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white">AI vs Human Agent Cost Calculator</h1>
        <p className="text-gray-400 mt-1 text-sm max-w-2xl">
          Compare the total operational cost of AI agents versus local Australian and offshore Filipino staff
          for debt collection. Adjust the parameters below to model your scenario.
        </p>
      </div>

      {/* ── Configuration panel ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Configuration</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          <CalcInput label="Calls Per Day"         value={callsPerDay}        onChange={setCallsPerDay}        min={1}    hint={`${numAgents} agent${numAgents !== 1 ? 's' : ''} needed`} />
          <CalcInput label="Avg Duration (min)"    value={avgDuration}        onChange={setAvgDuration}        step={0.5} min={0.5} />
          <CalcInput label="Local Rate (AUD/hr)"   value={localHourlyRate}    onChange={setLocalHourlyRate}    prefix="$" min={1} />
          <CalcInput label="Offshore Rate (AUD/hr)" value={offshoreHourlyRate} onChange={setOffshoreHourlyRate} prefix="$" min={1} />
          <CalcInput label="AI Cost / Min"          value={aiCostPerMin}       onChange={setAiCostPerMin}       prefix="$" step={0.01} min={0.01} />
          <CalcInput label="GPU Cost / Day"         value={gpuCostPerDay}      onChange={setGpuCostPerDay}      prefix="$" min={0} />
          <CalcInput label="Biz Days / Month"       value={bizDaysPerMonth}    onChange={setBizDaysPerMonth}    min={1} />
        </div>
      </div>

      {/* ── Summary KPI cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Local */}
        <div className="bg-gray-900 border border-red-900/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🇦🇺</span>
            <span className="text-sm font-medium text-gray-300">{numAgents} Local Staff (FTE)</span>
          </div>
          <div className="text-3xl font-bold text-red-400">{aud(localDaily, 0)}</div>
          <div className="text-xs text-gray-500 mt-0.5">per day · {aud(localPerFTE, 0)}/agent</div>
          <div className="mt-4 pt-3 border-t border-gray-800 grid grid-cols-3 gap-2 text-xs">
            <div><div className="text-gray-500 mb-0.5">Monthly</div><div className="text-red-300 font-semibold">{aud(localMonthly, 0)}</div></div>
            <div><div className="text-gray-500 mb-0.5">Annual</div><div className="text-red-300 font-semibold">{k(localMonthly * 12)}</div></div>
            <div><div className="text-gray-500 mb-0.5">Per Call</div><div className="text-red-300 font-semibold">{aud(localCPC, 2)}</div></div>
          </div>
        </div>

        {/* Offshore */}
        <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🇵🇭</span>
            <span className="text-sm font-medium text-gray-300">{numAgents} Offshore Staff (PH)</span>
          </div>
          <div className="text-3xl font-bold text-orange-400">{aud(offshoreDaily, 0)}</div>
          <div className="text-xs text-gray-500 mt-0.5">per day · {aud(offshorePerFTE, 0)}/agent</div>
          <div className="mt-4 pt-3 border-t border-gray-800 grid grid-cols-3 gap-2 text-xs">
            <div><div className="text-gray-500 mb-0.5">Monthly</div><div className="text-orange-300 font-semibold">{aud(offshoreMonthly, 0)}</div></div>
            <div><div className="text-gray-500 mb-0.5">Annual</div><div className="text-orange-300 font-semibold">{k(offshoreMonthly * 12)}</div></div>
            <div><div className="text-gray-500 mb-0.5">Per Call</div><div className="text-orange-300 font-semibold">{aud(offshoreCPC, 2)}</div></div>
          </div>
        </div>

        {/* AI */}
        <div className="bg-gray-900 border border-violet-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <span className="text-sm font-medium text-gray-300">AI Agent (unlimited)</span>
          </div>
          <div className="text-3xl font-bold text-violet-400">{aud(aiDaily, 0)}</div>
          <div className="text-xs text-gray-500 mt-0.5">per day · GPU + {aud(aiCostPerMin, 2)}/min usage</div>
          <div className="mt-4 pt-3 border-t border-gray-800 grid grid-cols-3 gap-2 text-xs">
            <div><div className="text-gray-500 mb-0.5">Monthly</div><div className="text-violet-300 font-semibold">{aud(aiMonthly, 0)}</div></div>
            <div><div className="text-gray-500 mb-0.5">Annual</div><div className="text-violet-300 font-semibold">{k(aiMonthly * 12)}</div></div>
            <div><div className="text-gray-500 mb-0.5">Per Call</div><div className="text-violet-300 font-semibold">{aud(aiCPC, 2)}</div></div>
          </div>
        </div>
      </div>

      {/* ── Daily cost bar chart ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">Daily Cost Comparison — {callsPerDay} calls</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dailyChart} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v) => [aud(Number(v ?? 0), 0), 'Daily cost']}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Bar dataKey="cost" radius={[4, 4, 0, 0]} maxBarSize={120}>
              {dailyChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Savings callout cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-950/40 border border-green-800/40 rounded-xl p-6">
          <div className="text-xs text-green-500 font-semibold uppercase tracking-wider mb-2">AI saves vs Local Staff</div>
          <div className="text-4xl font-bold text-green-400">{aud(savVsLocal, 0)}</div>
          <div className="text-sm text-green-300/70 mt-1">per month ({bizDaysPerMonth} days)</div>
          <div className="mt-4 flex gap-6 text-sm">
            <div><div className="text-gray-500 text-xs mb-0.5">1 Year</div><div className="text-green-300 font-bold text-lg">{aud(annVsLocal, 0)}</div></div>
            <div><div className="text-gray-500 text-xs mb-0.5">2 Years</div><div className="text-green-300 font-bold text-lg">{k(annVsLocal * 2)}</div></div>
            <div><div className="text-gray-500 text-xs mb-0.5">5 Years</div><div className="text-green-300 font-bold text-lg">{k(annVsLocal * 5)}</div></div>
          </div>
        </div>
        <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-6">
          <div className="text-xs text-emerald-500 font-semibold uppercase tracking-wider mb-2">AI saves vs Offshore Staff</div>
          <div className="text-4xl font-bold text-emerald-400">{aud(savVsOffshore, 0)}</div>
          <div className="text-sm text-emerald-300/70 mt-1">per month ({bizDaysPerMonth} days)</div>
          <div className="mt-4 flex gap-6 text-sm">
            <div><div className="text-gray-500 text-xs mb-0.5">1 Year</div><div className="text-emerald-300 font-bold text-lg">{aud(annVsOffshore, 0)}</div></div>
            <div><div className="text-gray-500 text-xs mb-0.5">2 Years</div><div className="text-emerald-300 font-bold text-lg">{k(annVsOffshore * 2)}</div></div>
            <div><div className="text-gray-500 text-xs mb-0.5">5 Years</div><div className="text-emerald-300 font-bold text-lg">{k(annVsOffshore * 5)}</div></div>
          </div>
        </div>
      </div>

      {/* ── Savings-over-time chart ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">Projected Savings Over Time</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={savingsChart} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v) => [aud(Number(v ?? 0), 0), '']}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
            <Bar dataKey="vsLocal"    name="vs Local Staff"    fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={80} />
            <Bar dataKey="vsOffshore" name="vs Offshore Staff" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={80} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Detailed per-FTE line-item breakdown ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Per-Agent Cost Breakdown (1 FTE / day)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs">
                <th className="text-left py-2 pr-6 text-gray-500 font-medium w-56">Cost Category</th>
                <th className="text-right py-2 px-4 text-gray-500 font-medium">🇦🇺 Local FTE</th>
                <th className="text-right py-2 px-4 text-gray-500 font-medium">🇵🇭 Offshore FTE</th>
                <th className="text-right py-2 px-4 text-gray-500 font-medium">🤖 AI Agent</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                  <td className="py-2 pr-6 text-gray-400 text-xs">{row.cat}</td>
                  <td className="py-2 px-4 text-right text-red-300/80 text-xs">{row.local}</td>
                  <td className="py-2 px-4 text-right text-orange-300/80 text-xs">{row.offshore}</td>
                  <td className="py-2 px-4 text-right text-violet-300/80 text-xs">{row.ai}</td>
                </tr>
              ))}
              {/* Per-FTE total */}
              <tr className="border-t-2 border-gray-600">
                <td className="py-3 pr-6 text-white font-semibold text-xs">Total Per FTE / Day</td>
                <td className="py-3 px-4 text-right text-red-400 font-bold">{aud(localPerFTE, 0)}</td>
                <td className="py-3 px-4 text-right text-orange-400 font-bold">{aud(offshorePerFTE, 0)}</td>
                <td className="py-3 px-4 text-right text-violet-400 font-bold">{aud(aiCPC * 100, 0)} <span className="text-gray-500 font-normal text-xs">(per 100 calls)</span></td>
              </tr>
              {/* Scaled total */}
              <tr className="bg-gray-800/30">
                <td className="py-3 pr-6 text-white font-semibold text-xs">Total Daily ({numAgents} agents, {callsPerDay} calls)</td>
                <td className="py-3 px-4 text-right text-red-400 font-bold text-base">{aud(localDaily, 0)}</td>
                <td className="py-3 px-4 text-right text-orange-400 font-bold text-base">{aud(offshoreDaily, 0)}</td>
                <td className="py-3 px-4 text-right text-violet-400 font-bold text-base">{aud(aiDaily, 0)}</td>
              </tr>
              {/* Cost per call */}
              <tr>
                <td className="py-2 pr-6 text-gray-400 text-xs">Cost Per Call</td>
                <td className="py-2 px-4 text-right text-red-300 text-xs font-medium">{aud(localCPC, 2)}</td>
                <td className="py-2 px-4 text-right text-orange-300 text-xs font-medium">{aud(offshoreCPC, 2)}</td>
                <td className="py-2 px-4 text-right text-violet-300 text-xs font-medium">{aud(aiCPC, 2)}</td>
              </tr>
              {/* Cost per SMS (300/day) */}
              <tr className="border-b border-gray-800/40">
                <td className="py-2 pr-6 text-gray-400 text-xs">Cost Per SMS (300/day basis)</td>
                <td className="py-2 px-4 text-right text-red-300 text-xs font-medium">{aud(localDaily / 300, 2)}</td>
                <td className="py-2 px-4 text-right text-orange-300 text-xs font-medium">{aud(offshoreDaily / 300, 2)}</td>
                <td className="py-2 px-4 text-right text-violet-300 text-xs font-medium">$0.15</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Monthly cost table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Monthly &amp; Annual Cost Summary ({bizDaysPerMonth} business days)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs">
                <th className="text-left py-2 pr-6 text-gray-500 font-medium">Option</th>
                <th className="text-right py-2 px-4 text-gray-500 font-medium">Daily</th>
                <th className="text-right py-2 px-4 text-gray-500 font-medium">Monthly (×{bizDaysPerMonth})</th>
                <th className="text-right py-2 px-4 text-gray-500 font-medium">Annual (×12)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800/40">
                <td className="py-3 pr-6 text-gray-300">🇦🇺 {numAgents} Local Staff</td>
                <td className="py-3 px-4 text-right text-red-300">{aud(localDaily, 0)}</td>
                <td className="py-3 px-4 text-right text-red-300 font-semibold">{aud(localMonthly, 0)}</td>
                <td className="py-3 px-4 text-right text-red-400 font-bold">{k(localMonthly * 12)}</td>
              </tr>
              <tr className="border-b border-gray-800/40">
                <td className="py-3 pr-6 text-gray-300">🇵🇭 {numAgents} Offshore Staff</td>
                <td className="py-3 px-4 text-right text-orange-300">{aud(offshoreDaily, 0)}</td>
                <td className="py-3 px-4 text-right text-orange-300 font-semibold">{aud(offshoreMonthly, 0)}</td>
                <td className="py-3 px-4 text-right text-orange-400 font-bold">{k(offshoreMonthly * 12)}</td>
              </tr>
              <tr className="bg-violet-950/20">
                <td className="py-3 pr-6 text-gray-300">🤖 AI Agent (Usage + GPU)</td>
                <td className="py-3 px-4 text-right text-violet-300">{aud(aiDaily, 0)}</td>
                <td className="py-3 px-4 text-right text-violet-300 font-semibold">{aud(aiMonthly, 0)}</td>
                <td className="py-3 px-4 text-right text-violet-400 font-bold">{k(aiMonthly * 12)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Savings highlight */}
        <div className="mt-4 p-4 bg-gray-800/40 rounded-lg border border-gray-700/50">
          <p className="text-xs text-gray-400 leading-relaxed">
            AI agents deliver approximately{' '}
            <span className="text-green-400 font-semibold">{aud(annVsLocal, 0)} saved in year 1</span>{' '}
            compared to local staff, and{' '}
            <span className="text-emerald-400 font-semibold">{aud(annVsOffshore, 0)} saved in year 1</span>{' '}
            compared to offshore staff, for handling {callsPerDay} calls daily.
            Over 5 years that is{' '}
            <span className="text-green-300 font-bold">{k(annVsLocal * 5)}</span>{' '}
            vs local and{' '}
            <span className="text-emerald-300 font-bold">{k(annVsOffshore * 5)}</span>{' '}
            vs offshore.
          </p>
        </div>
      </div>

      {/* ── Capability comparison ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Capability &amp; Risk Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs">
                <th className="text-left py-2 pr-6 text-gray-500 font-medium w-56">Feature</th>
                <th className="text-center py-2 px-4 text-gray-500 font-medium">🇦🇺 Local</th>
                <th className="text-center py-2 px-4 text-gray-500 font-medium">🇵🇭 Offshore</th>
                <th className="text-center py-2 px-4 text-gray-500 font-medium">🤖 AI Agent</th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map((cap, i) => (
                <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                  <td className="py-2.5 pr-6 text-gray-300 text-xs">{cap.feature}</td>
                  {[cap.local, cap.offshore, cap.ai].map((val, j) => (
                    <td key={j} className="py-2.5 px-4 text-center text-xs">
                      <CapCell val={val} positiveWhenTrue={cap.positiveWhenTrue} colIdx={j} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
