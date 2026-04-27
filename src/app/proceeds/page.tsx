'use client';

import { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, ReferenceLine,
} from 'recharts';
import {
  Download, TrendingUp, Users, DollarSign, Target,
  ChevronDown, ChevronRight, CheckCircle2, Clock, Zap, Shield,
  Building2, Cpu, Headphones, Scale, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Colour palette ──────────────────────────────────────────────────────────────
const COLORS = {
  gtm:        '#8b5cf6',   // violet
  product:    '#3b82f6',   // blue
  compute:    '#06b6d4',   // cyan
  operations: '#10b981',   // emerald
  compliance: '#f59e0b',   // amber
};

// ── Data ────────────────────────────────────────────────────────────────────────

const allocation = [
  { key: 'gtm',        label: 'Go-To-Market & Sales',       amount: 481500, pct: 40.1, color: COLORS.gtm,        icon: TrendingUp },
  { key: 'product',    label: 'Product & Engineering',       amount: 300500, pct: 25.0, color: COLORS.product,    icon: Zap },
  { key: 'compute',    label: 'Compute Infrastructure',      amount: 241000, pct: 20.1, color: COLORS.compute,    icon: Cpu },
  { key: 'operations', label: 'Operations & Customer Success',amount: 120500, pct: 10.0, color: COLORS.operations, icon: Headphones },
  { key: 'compliance', label: 'Compliance, Legal & Admin',   amount:  56500, pct:  4.7, color: COLORS.compliance, icon: Shield },
];

const breakdowns: Record<string, { label: string; amount: number; description: string }[]> = {
  gtm: [
    { label: 'Sales Hire 1 (Q1)', amount: 53500, description: 'Base salary pro-rata + commission + ~$8k recruitment' },
    { label: 'Sales Hire 2 (Q1)', amount: 53500, description: 'Base salary pro-rata + commission + ~$8k recruitment' },
    { label: 'Sales Hire 3 (Q2)', amount: 42300, description: 'Base salary pro-rata + commission + ~$8k recruitment' },
    { label: 'Sales Hire 4 (Q2)', amount: 42300, description: 'Base salary pro-rata + commission + ~$8k recruitment' },
    { label: 'Sales Hire 5 (Q3)', amount: 29800, description: 'Base salary pro-rata for second half of deployment' },
    { label: 'CRM & Sales Tooling', amount: 21500, description: 'HubSpot, Instantly.ai, Apollo.io, LinkedIn Sales Nav' },
    { label: 'Onboarding & Enablement', amount: 46000, description: 'Playbook, training programmes, collateral production' },
    { label: 'Paid Digital Ads', amount: 52000, description: '~$4,300/mo across Google & LinkedIn for 12 months' },
    { label: 'Industry Events', amount: 28500, description: '2–3 major events; real estate & collections verticals' },
    { label: 'Content Marketing', amount: 19875, description: 'SEO, case studies, white papers for inbound pipeline' },
    { label: 'PR & Media', amount: 12000, description: 'Trade & B2B media to build brand authority' },
    { label: 'Marketing Automation', amount: 8000, description: 'HubSpot sequences, landing pages, lead tracking' },
    { label: 'Partnership BD Resource', amount: 36000, description: 'Dedicated BD resource at $3k/month for 12 months' },
    { label: 'Co-Marketing & Campaigns', amount: 18225, description: 'Partner-funded campaigns, co-branded collateral' },
    { label: 'Integration Connectors', amount: 18000, description: 'API connectors with partner platforms' },
  ],
  product: [
    { label: 'Senior Engineer 1 (Q1)', amount: 78000, description: 'Full-year; platform stability, uptime, infrastructure' },
    { label: 'Senior Engineer 2 (Q2)', amount: 58500, description: 'Half-year; integrations and deployment tooling' },
    { label: 'Recruitment Costs', amount: 18000, description: 'Agency fees, job boards, technical assessments' },
    { label: 'Contractor / Specialist', amount: 25800, description: 'Short-term specialist for multi-agent / LLM infra' },
    { label: 'Voice AI Reliability', amount: 32500, description: 'Latency, call accuracy, uptime SLAs for renewals' },
    { label: 'Multi-Agent Orchestration', amount: 28000, description: 'Productised multi-step AI workflows' },
    { label: 'CRM Integrations (5+)', amount: 24500, description: 'REA Group, PropertyMe, MYOB, Salesforce & others' },
    { label: 'Analytics Dashboard', amount: 19200, description: 'Client-facing agent performance & ROI metrics' },
    { label: 'Deployment Automation', amount: 16000, description: 'Compress contract-to-go-live time by ≥50%' },
  ],
  compute: [
    { label: 'GPU Lease — Primary Cluster', amount: 144000, description: '~$12k/mo; A100/H100 production voice agents' },
    { label: 'GPU Lease — Dev & Staging', amount: 24000, description: '~$2k/mo; model testing & staging environment' },
    { label: 'Infrastructure Management', amount: 14500, description: 'Monitoring, alerting, auto-scaling, ops tooling' },
    { label: 'Redundancy & Failover', amount: 28500, description: 'Secondary region standby, disaster recovery testing' },
    { label: 'Capacity Planning & Review', amount: 18000, description: 'Specialist advisory; 12–18 month capacity modelling' },
    { label: 'Data Sovereignty Docs', amount: 12000, description: 'Formal audit trail for enterprise due diligence' },
  ],
  operations: [
    { label: 'Customer Success Manager', amount: 72000, description: 'Dedicated CSM ~$72k p.a.; onboarding, QA, growth' },
    { label: 'Onboarding Process Dev', amount: 14500, description: 'Playbook, client portal, onboarding automation' },
    { label: 'QA Infrastructure', amount: 16000, description: 'Tooling & manual QA for ongoing agent performance' },
    { label: 'Expansion Revenue Programmes', amount: 9000, description: 'Account review cadence, upsell motion, usage reporting' },
    { label: 'Client Reporting Infra', amount: 9000, description: 'QBR templates, success metrics framework' },
  ],
  compliance: [
    { label: 'Regulatory Compliance Review', amount: 14500, description: 'Privacy Act, ACMA telecomms, ASIC/APRA sector rules' },
    { label: 'Data Security Assessments', amount: 11000, description: 'ISO 27001 readiness, SOC 2 gap analysis' },
    { label: 'Enterprise Contract Legal', amount: 13000, description: 'MSA templates, IP assignments, partner agreements' },
    { label: 'Investor & Corporate Docs', amount: 6000, description: 'Shareholder agreements, cap table, ESOP docs' },
    { label: 'General Admin Overhead', amount: 12000, description: 'Software licences, D&O insurance, ASIC fees' },
  ],
};

const phases = [
  {
    period: 'Months 1–3',
    label: 'Foundation',
    color: '#8b5cf6',
    milestones: [
      'Sales recruitment — first 3 hires onboarded',
      'GPU lease agreements executed',
      'Outbound tooling live (HubSpot, Instantly, Apollo)',
      'Engineering recruitment commenced',
      'Partner conversations initiated in RE & debt collection',
    ],
  },
  {
    period: 'Months 4–6',
    label: 'Acceleration',
    color: '#3b82f6',
    arrTarget: 1_800_000,
    milestones: [
      'All 5 sales hires ramped and at full productivity',
      'GPU infrastructure fully operational with failover',
      'Both engineering hires contributing to roadmap',
      'First channel partnership signed',
      'CRM integrations shipped to clients',
    ],
  },
  {
    period: 'Months 7–12',
    label: 'Scale',
    color: '#10b981',
    arrTarget: 2_750_000,
    milestones: [
      'Full sales team at peak productivity',
      'Multi-agent orchestration in production',
      'Client analytics dashboard launched',
      'NRR programme driving >110% retention',
      'International expansion groundwork commenced',
    ],
  },
  {
    period: 'Months 13–18',
    label: 'Series A Prep',
    color: '#f59e0b',
    arrTarget: 3_500_000,
    milestones: [
      'Enterprise deals from months 9–12 closing',
      'Series A raise preparation underway',
      'First international client live',
      'ARR target $3.5M+',
    ],
  },
];

const arrTrajectory = [
  { label: 'Today',     arr: 1_200_000, phase: 'current' },
  { label: 'Month 3',   arr: 1_400_000, phase: 'foundation' },
  { label: 'Month 6',   arr: 1_800_000, phase: 'acceleration' },
  { label: 'Month 9',   arr: 2_200_000, phase: 'scale' },
  { label: 'Month 12',  arr: 2_750_000, phase: 'scale' },
  { label: 'Month 18',  arr: 3_500_000, phase: 'buffer' },
];

const burnScenarios = [
  { period: 'Current',   fullRaise: 28000,  minRaise: 28000 },
  { period: 'Months 1–3', fullRaise: 57500,  minRaise: 40000 },
  { period: 'Months 4–6', fullRaise: 100000, minRaise: 65000 },
  { period: 'Months 7–12',fullRaise: 80000,  minRaise: 55000 },
];

// ── Format helpers ───────────────────────────────────────────────────────────────
function fmtAUD(n: number) {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${(n / 1_000).toFixed(0)}k`;
}
function fmtFull(n: number) {
  return '$' + n.toLocaleString('en-AU');
}

// ── Custom pie label ─────────────────────────────────────────────────────────────
interface PieLabelProps {
  cx?: number; cy?: number; midAngle?: number; innerRadius?: number;
  outerRadius?: number; pct?: number; name?: string;
}
function PieLabel({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, pct = 0 }: PieLabelProps) {
  if (pct < 8) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={12} fontWeight={700}>
      {`${pct.toFixed(0)}%`}
    </text>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────────
export default function ProceedsPage() {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(0);

  const activeCategory = activeKey ? allocation.find(a => a.key === activeKey) : null;
  const activeBreakdown = activeKey ? (breakdowns[activeKey] ?? []) : [];

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <p className="text-xs text-violet-400 uppercase tracking-widest font-semibold mb-1">Next Raise</p>
          <h1 className="text-2xl font-bold text-gray-100 leading-tight">Use of Proceeds</h1>
          <p className="text-gray-400 text-sm mt-1">
            Seed / Series A · $1,200,000 Target · Voice AI Solutions Pty Ltd
          </p>
        </div>
        <a
          href="/VoiceAI_Use_of_Proceeds_1.2M.docx"
          download
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-200 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shrink-0"
        >
          <Download className="w-4 h-4 text-violet-400" />
          Download Full Document
        </a>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Current ARR', value: '$1.20M', sub: 'in 6 months from 4 people', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-800/50' },
          { label: 'Raise Target', value: '$1.20M', sub: 'min raise $600k', icon: DollarSign, color: 'text-violet-400', bg: 'bg-violet-950/30 border-violet-800/50' },
          { label: 'Target ARR', value: '$2.5–3M', sub: 'within 12–18 months', icon: Target, color: 'text-blue-400', bg: 'bg-blue-950/30 border-blue-800/50' },
          { label: 'Team Growth', value: '4 → 12', sub: 'FTEs over deployment', icon: Users, color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-800/50' },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className={cn('border rounded-xl p-4 sm:p-5', bg)}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn('w-4 h-4 shrink-0', color)} />
              <p className="text-xs text-gray-400">{label}</p>
            </div>
            <p className={cn('text-xl sm:text-2xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Allocation overview ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-200">Capital Allocation</h2>
          <p className="text-xs text-gray-500 mt-0.5">Click any segment or row to explore the detailed line-item breakdown</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-center">
          {/* Donut chart */}
          <div className="w-full lg:w-72 shrink-0">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={allocation}
                  dataKey="amount"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={110}
                  paddingAngle={2}
                  labelLine={false}
                  label={PieLabel}
                  onClick={(_, idx) => {
                    const k = allocation[idx]?.key;
                    setActiveKey(prev => prev === k ? null : k);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {allocation.map(a => (
                    <Cell
                      key={a.key}
                      fill={a.color}
                      opacity={activeKey === null || activeKey === a.key ? 1 : 0.3}
                      stroke={activeKey === a.key ? 'white' : 'transparent'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [fmtFull(v), 'Amount']}
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-gray-500 -mt-2">Total: $1,200,000</p>
          </div>

          {/* Allocation rows */}
          <div className="flex-1 w-full space-y-2">
            {allocation.map(a => {
              const isActive = activeKey === a.key;
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  onClick={() => setActiveKey(prev => prev === a.key ? null : a.key)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                    isActive
                      ? 'border-gray-600 bg-gray-800'
                      : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/50',
                    !isActive && activeKey && 'opacity-50'
                  )}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <Icon className="w-4 h-4 shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-200 font-medium truncate">{a.label}</span>
                      <span className="text-xs font-bold shrink-0" style={{ color: a.color }}>{a.pct}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${a.pct}%`, background: a.color }} />
                    </div>
                  </div>
                  <span className="text-sm font-mono font-semibold text-gray-300 shrink-0">{fmtFull(a.amount)}</span>
                  {isActive ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Category drilldown ── */}
      {activeCategory && (
        <div className="bg-gray-900 border rounded-xl p-5 sm:p-6 transition-all" style={{ borderColor: activeCategory.color + '40' }}>
          <div className="flex flex-wrap items-center gap-3 mb-5 justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: activeCategory.color }} />
              <h2 className="text-sm font-semibold text-gray-200">{activeCategory.label}</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: activeCategory.color + '20', color: activeCategory.color }}>
                {fmtFull(activeCategory.amount)} · {activeCategory.pct}%
              </span>
            </div>
            <button onClick={() => setActiveKey(null)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Close ✕
            </button>
          </div>

          <div className="flex flex-col xl:flex-row gap-6">
            {/* Bar chart */}
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height={Math.max(240, activeBreakdown.length * 36)}>
                <BarChart data={activeBreakdown} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                  <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" stroke="#6b7280"
                    tick={{ fontSize: 11, fill: '#9ca3af' }} width={160} />
                  <Tooltip
                    formatter={(v: number) => [fmtFull(v), 'Amount']}
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8 }}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} fill={activeCategory.color} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Line item table */}
            <div className="w-full xl:w-72 shrink-0">
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {activeBreakdown.map((item, i) => (
                  <div key={i} className="bg-gray-800/60 rounded-lg px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-300 font-medium leading-tight">{item.label}</span>
                      <span className="text-xs font-mono font-semibold shrink-0" style={{ color: activeCategory.color }}>
                        {fmtFull(item.amount)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Category Total</span>
                <span className="text-sm font-bold font-mono" style={{ color: activeCategory.color }}>
                  {fmtFull(activeCategory.amount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ARR Trajectory ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-200">Projected ARR Trajectory</h2>
          <p className="text-xs text-gray-500 mt-0.5">Based on full $1.2M raise deployed per plan · $1.2M current → $3.5M+ at month 18</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={arrTrajectory} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="arrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
            <Tooltip
              formatter={(v: number) => [fmtFull(v), 'ARR']}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8 }}
            />
            <ReferenceLine y={1_200_000} stroke="#374151" strokeDasharray="4 2"
              label={{ value: 'Current $1.2M', fill: '#6b7280', fontSize: 10, position: 'insideTopLeft' }} />
            <Area type="monotone" dataKey="arr" stroke="#8b5cf6" fill="url(#arrGrad)" strokeWidth={2.5}
              dot={{ fill: '#8b5cf6', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#a78bfa' }} />
          </AreaChart>
        </ResponsiveContainer>
        {/* ARR milestone chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: 'Today', value: '$1.2M', color: '#6b7280' },
            { label: 'Month 6', value: '$1.8M', color: '#3b82f6' },
            { label: 'Month 12', value: '$2.5–3M', color: '#10b981' },
            { label: 'Month 18', value: '$3.5M+', color: '#8b5cf6' },
            { label: 'Post Series A', value: '$6–8M', color: '#f59e0b' },
          ].map(chip => (
            <div key={chip.label} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: chip.color }} />
              <span className="text-xs text-gray-400">{chip.label}</span>
              <span className="text-xs font-bold" style={{ color: chip.color }}>{chip.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Milestones ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-200">Deployment Timeline & Milestones</h2>
          <p className="text-xs text-gray-500 mt-0.5">Click a phase to expand milestone detail</p>
        </div>

        {/* Phase connector bar */}
        <div className="hidden sm:flex items-center mb-6 gap-0">
          {phases.map((ph, i) => (
            <div key={i} className="flex-1 flex items-center">
              <button
                onClick={() => setExpandedPhase(prev => prev === i ? null : i)}
                className="flex-1 relative"
              >
                <div
                  className="h-2.5 rounded-full transition-all"
                  style={{
                    background: ph.color,
                    opacity: expandedPhase === null || expandedPhase === i ? 1 : 0.35,
                  }}
                />
                <span className="absolute -bottom-6 left-0 text-[10px] text-gray-500 whitespace-nowrap">{ph.period}</span>
                <span className="absolute -top-5 left-0 text-[11px] font-semibold whitespace-nowrap" style={{ color: ph.color }}>{ph.label}</span>
              </button>
              {i < phases.length - 1 && <div className="w-1 h-2.5 bg-gray-700" />}
            </div>
          ))}
        </div>

        <div className="mt-8 sm:mt-10 space-y-3">
          {phases.map((ph, i) => {
            const isOpen = expandedPhase === i;
            return (
              <div
                key={i}
                className="border rounded-xl overflow-hidden transition-all"
                style={{ borderColor: isOpen ? ph.color + '60' : '#374151' }}
              >
                <button
                  onClick={() => setExpandedPhase(prev => prev === i ? null : i)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ph.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-200">{ph.period} — {ph.label}</span>
                      {ph.arrTarget && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: ph.color + '20', color: ph.color }}>
                          ARR target: {fmtAUD(ph.arrTarget)}
                        </span>
                      )}
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  }
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 border-t border-gray-800">
                    <ul className="mt-3 space-y-2">
                      {ph.milestones.map((m, mi) => (
                        <li key={mi} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ph.color }} />
                          <span className="text-sm text-gray-300">{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Runway analysis ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-200">Burn Rate & Runway Analysis</h2>
          <p className="text-xs text-gray-500 mt-0.5">Monthly burn by phase — full raise vs minimum raise scenarios</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={burnScenarios} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="period" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    `$${v.toLocaleString()}/mo`,
                    name === 'fullRaise' ? 'Full $1.2M raise' : 'Min $600k raise',
                  ]}
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8 }}
                />
                <Legend
                  formatter={(v) => v === 'fullRaise' ? 'Full $1.2M raise' : 'Min $600k raise'}
                  wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
                />
                <Bar dataKey="fullRaise"  fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={60} />
                <Bar dataKey="minRaise"   fill="#374151" radius={[3, 3, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Runway metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:w-52 shrink-0">
            {[
              { label: 'Static runway (full)', value: '~43 months', sub: 'at $28k/mo burn', color: '#8b5cf6' },
              { label: 'Static runway (min)', value: '~21 months', sub: 'at $28k/mo burn', color: '#6b7280' },
              { label: 'Peak burn (months 4–6)', value: '$90–110k/mo', sub: 'full headcount period', color: '#ef4444' },
              { label: 'Cash-flow neutral target', value: 'Month 10–12', sub: 'ARR offsetting burn', color: '#10b981' },
            ].map(m => (
              <div key={m.label} className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{m.label}</p>
                <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Expected outcomes ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-200">Expected Outcomes — 12 to 18 Months</h2>
          <p className="text-xs text-gray-500 mt-0.5">Upon full deployment of the $1.2M raise</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: TrendingUp,
              label: 'Revenue & Growth',
              color: '#10b981',
              points: [
                'ARR $2.5M–$3.0M (2.1–2.5× growth)',
                'Predictable MRR with consistent month-on-month growth',
                'Net revenue retention >110%',
              ],
            },
            {
              icon: Building2,
              label: 'Commercial Infrastructure',
              color: '#8b5cf6',
              points: [
                '5 fully ramped B2B sales professionals',
                'Active channel partnerships in ≥2 verticals',
                'Repeatable GTM motion with defined ICP & playbook',
              ],
            },
            {
              icon: Zap,
              label: 'Product & Technology',
              color: '#3b82f6',
              points: [
                'Platform supports 5× current client volume',
                'Multi-agent orchestration in production',
                'Deployment time reduced ≥50%; 5+ CRM integrations',
                'Dedicated AU GPU infra with data sovereignty',
              ],
            },
            {
              icon: Scale,
              label: 'Fundraising Position',
              color: '#f59e0b',
              points: [
                '10–12 FTEs across sales, engineering & CS',
                'Compliance framework for regulated verticals',
                'Positioned for Series A on ARR trajectory',
                'Clear path to $6M–$8M ARR with Series A',
              ],
            },
          ].map(({ icon: Icon, label, color, points }) => (
            <div key={label} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                <h3 className="text-xs font-semibold text-gray-200">{label}</h3>
              </div>
              <ul className="space-y-1.5">
                {points.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" style={{ color }} />
                    <span className="text-xs text-gray-400 leading-relaxed">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer callout ── */}
      <div className="bg-gradient-to-r from-violet-950/40 via-violet-900/20 to-transparent border border-violet-800/30 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-200 leading-snug">
              $1.2M ARR in six months from a four-person team is a remarkable commercial achievement.
            </p>
            <p className="text-xs text-gray-500 mt-1.5">
              This capital will transform early traction into a durable, scalable revenue engine — and position
              Voice AI Solutions as the leading voice AI platform for enterprise clients in Australia and beyond.
            </p>
          </div>
          <a
            href="/VoiceAI_Use_of_Proceeds_1.2M.docx"
            download
            className="flex items-center gap-2 bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            Full Document
          </a>
        </div>
      </div>

    </div>
  );
}
