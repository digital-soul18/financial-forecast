'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';
import {
  Download, TrendingUp, Users, DollarSign, Target,
  ChevronDown, ChevronRight, CheckCircle2, Zap, Shield,
  Building2, Cpu, Headphones, Scale, ArrowRight,
  Phone, GitBranch, MessageSquare, Database, Bot,
  Clock, Star, Globe, X, ChevronLeft, Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Colour palette ──────────────────────────────────────────────────────────────
const COLORS = {
  gtm:        '#8b5cf6',
  product:    '#3b82f6',
  compute:    '#06b6d4',
  operations: '#10b981',
  compliance: '#f59e0b',
};

// ── Capital allocation ──────────────────────────────────────────────────────────
const allocation = [
  { key: 'gtm',        label: 'Go-To-Market & Sales',        amount: 481500, pct: 40.1, color: COLORS.gtm,        icon: TrendingUp },
  { key: 'product',    label: 'Product & Engineering',        amount: 300500, pct: 25.0, color: COLORS.product,    icon: Zap },
  { key: 'compute',    label: 'Compute Infrastructure',       amount: 241000, pct: 20.1, color: COLORS.compute,    icon: Cpu },
  { key: 'operations', label: 'Operations & Customer Success', amount: 120500, pct: 10.0, color: COLORS.operations, icon: Headphones },
  { key: 'compliance', label: 'Compliance, Legal & Admin',    amount:  56500, pct:  4.7, color: COLORS.compliance, icon: Shield },
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

// ── Deployment phases (with per-phase cost breakdown) ──────────────────────────
const phases = [
  {
    period: 'Months 1–3',
    label: 'Foundation',
    color: '#8b5cf6',
    burnEstimate: '$65–80k/mo',
    milestones: [
      'Sales recruitment — first 3 hires onboarded',
      'GPU lease agreements executed',
      'Outbound tooling live (HubSpot, Instantly, Apollo)',
      'Engineering recruitment commenced',
      'Partner conversations initiated in RE & debt collection',
    ],
    costs: [
      { label: 'Sales Hires 1 & 2 (Q1 salaries + recruitment)', amount: 107000, cat: 'gtm', color: COLORS.gtm },
      { label: 'GPU Lease — Primary + Dev (3 months)', amount: 42000, cat: 'compute', color: COLORS.compute },
      { label: 'CRM & Outbound Sales Tooling', amount: 21500, cat: 'gtm', color: COLORS.gtm },
      { label: 'Engineering Recruitment', amount: 18000, cat: 'product', color: COLORS.product },
      { label: 'Content Marketing & SEO Foundation', amount: 19875, cat: 'gtm', color: COLORS.gtm },
      { label: 'Compliance & Regulatory Review', amount: 14500, cat: 'compliance', color: COLORS.compliance },
      { label: 'Partnership BD Resource (3 months)', amount: 9000, cat: 'gtm', color: COLORS.gtm },
    ],
  },
  {
    period: 'Months 4–6',
    label: 'Acceleration',
    color: '#3b82f6',
    arrTarget: 900_000,
    burnEstimate: '$95–110k/mo',
    milestones: [
      'All 5 sales hires ramped and at full productivity',
      'GPU infrastructure fully operational with failover',
      'Both engineering hires contributing to roadmap',
      'First channel partnership signed',
      'CRM integrations shipped to clients',
    ],
    costs: [
      { label: 'Sales Hires 3 & 4 (Q2 salaries + recruitment)', amount: 84600, cat: 'gtm', color: COLORS.gtm },
      { label: 'Senior Engineer 2 (Q2 hire, half-year)', amount: 29250, cat: 'product', color: COLORS.product },
      { label: 'GPU Lease — Primary + Dev (3 months)', amount: 42000, cat: 'compute', color: COLORS.compute },
      { label: 'CRM Integrations (5+ platforms)', amount: 24500, cat: 'product', color: COLORS.product },
      { label: 'Paid Digital Advertising (3 months)', amount: 13000, cat: 'gtm', color: COLORS.gtm },
      { label: 'Customer Success Manager setup', amount: 14500, cat: 'operations', color: COLORS.operations },
      { label: 'Partnership BD Resource (3 months)', amount: 9000, cat: 'gtm', color: COLORS.gtm },
      { label: 'Onboarding & Enablement Playbook', amount: 23000, cat: 'gtm', color: COLORS.gtm },
    ],
  },
  {
    period: 'Months 7–12',
    label: 'Scale',
    color: '#10b981',
    arrTarget: 2_200_000,
    burnEstimate: '$75–90k/mo',
    milestones: [
      'Full sales team at peak productivity',
      'Multi-agent orchestration in production',
      'Client analytics dashboard launched',
      'NRR programme driving >110% retention',
      'International expansion groundwork commenced',
    ],
    costs: [
      { label: 'Sales Hire 5 (Q3 salary + recruitment)', amount: 29800, cat: 'gtm', color: COLORS.gtm },
      { label: 'GPU Lease — Primary + Dev (6 months)', amount: 84000, cat: 'compute', color: COLORS.compute },
      { label: 'Multi-Agent Orchestration (engineering)', amount: 28000, cat: 'product', color: COLORS.product },
      { label: 'Customer Success Manager (6 months)', amount: 36000, cat: 'operations', color: COLORS.operations },
      { label: 'Paid Digital Advertising (6 months)', amount: 26000, cat: 'gtm', color: COLORS.gtm },
      { label: 'Client Analytics Dashboard', amount: 19200, cat: 'product', color: COLORS.product },
      { label: 'QA Infrastructure & Deployment Automation', amount: 32000, cat: 'product', color: COLORS.product },
      { label: 'Redundancy, Failover & Capacity Review', amount: 46500, cat: 'compute', color: COLORS.compute },
    ],
  },
  {
    period: 'Months 13–18',
    label: 'Series A Prep',
    color: '#f59e0b',
    arrTarget: 3_500_000,
    burnEstimate: '$40–60k/mo',
    milestones: [
      'Enterprise deals from months 9–12 closing',
      'Series A raise preparation underway',
      'First international client live',
      'ARR target $3.5M+',
    ],
    costs: [
      { label: 'GPU Lease — Primary + Dev (6 months)', amount: 84000, cat: 'compute', color: COLORS.compute },
      { label: 'International Co-Marketing & Expansion', amount: 18225, cat: 'gtm', color: COLORS.gtm },
      { label: 'Capacity Planning & Advisory', amount: 18000, cat: 'compute', color: COLORS.compute },
      { label: 'Enterprise Contract & Legal', amount: 13000, cat: 'compliance', color: COLORS.compliance },
      { label: 'Expansion Revenue Programmes', amount: 9000, cat: 'operations', color: COLORS.operations },
      { label: 'Series A Legal & Corporate Docs', amount: 6000, cat: 'compliance', color: COLORS.compliance },
      { label: 'Client Reporting Infrastructure', amount: 9000, cat: 'operations', color: COLORS.operations },
    ],
  },
];

// ── ARR trajectory (projected from raise close, not current ARR) ───────────────
const arrTrajectory = [
  { label: 'Raise\nClose', arr: 120_000,   phase: 'start' },
  { label: 'Month 3',      arr: 400_000,   phase: 'foundation' },
  { label: 'Month 6',      arr: 900_000,   phase: 'acceleration' },
  { label: 'Month 9',      arr: 1_600_000, phase: 'scale' },
  { label: 'Month 12',     arr: 2_200_000, phase: 'scale' },
  { label: 'Month 18',     arr: 3_500_000, phase: 'buffer' },
];

const burnScenarios = [
  { period: 'Current',    fullRaise: 28000,  minRaise: 28000 },
  { period: 'Months 1–3', fullRaise: 72500,  minRaise: 45000 },
  { period: 'Months 4–6', fullRaise: 100000, minRaise: 65000 },
  { period: 'Months 7–12',fullRaise: 82000,  minRaise: 55000 },
];

// ── Achievements data ────────────────────────────────────────────────────────────
const executionTimeline = [
  { month: 'Month 1', label: 'Incorporated', desc: 'Company founded with clear thesis: private, compliant AI built first for the hardest regulated environments.' },
  { month: 'Month 2', label: 'First Deployment', desc: 'First private deployment in healthcare — AI Medical Receptionist live at a Western Sydney dermatology clinic, handling patient bookings and after-hours calls.' },
  { month: 'Month 3', label: 'Debt Collection Live', desc: 'Debt collection vertical onboarded — validating the compliance framework across strict regulatory scripts and sensitive financial conversations.' },
  { month: 'Month 4', label: 'Workflow Engine', desc: 'Configurable visual workflow engine launched — unlocking multi-industry capability with drag-and-drop flow design, no coding required.' },
  { month: 'Month 5', label: 'Enterprise Partnership', desc: 'First enterprise partnership signed, establishing a scalable channel to market and accelerating distribution into regulated verticals.' },
  { month: 'Month 6', label: 'Global Expansion', desc: 'Global expansion strategy activated — banking, finance, and insurance identified as next regulated verticals. International growth roadmap underway.' },
];

const platformFeatures = [
  { icon: Phone,          label: 'AI Voice Agents',          desc: 'Inbound & outbound — reception, sales, debt collection — each with configurable scripts, compliance rules, and their own persona', color: COLORS.gtm },
  { icon: GitBranch,      label: 'Visual Flow Designer',      desc: 'Node-based drag-and-drop canvas for configuring full agent conversations — business rules, escalation paths, compliance guardrails', color: COLORS.product },
  { icon: TrendingUp,     label: 'Operations Dashboard',      desc: 'Real-time call volumes, SMS activity, meetings booked, campaign performance, and hourly call distribution at a glance', color: COLORS.compute },
  { icon: Bot,            label: 'AI Analytics Agent',        desc: 'Conversational AI that reviews your entire call centre operation and generates executive reports and insights on demand', color: COLORS.operations },
  { icon: Users,          label: 'Multi-Agent Config',        desc: 'Multiple AI agents per account — reception, sales, customer service, debt collection — each running concurrently and independently', color: COLORS.compliance },
  { icon: MessageSquare,  label: 'SMS + Voice Campaigns',     desc: 'Outbound campaign management across both channels — automated, compliant, and fully tracked with delivery and response analytics', color: '#ec4899' },
  { icon: Database,       label: 'Knowledge Base',            desc: 'Built-in training knowledge repository that shapes each agent\'s responses, escalation logic, and decision-making at runtime', color: COLORS.gtm },
  { icon: Building2,      label: 'Reseller Module',           desc: 'White-label partner portal showing revenue generated per client — channel partners manage and grow their book of business independently', color: COLORS.product },
  { icon: Star,           label: 'Meeting Booking',           desc: 'AI agents book meetings directly into calendars during calls — 12 meetings booked in last tracked period, +450% vs prior', color: COLORS.compute },
  { icon: Shield,         label: 'Compliance-First Arch',     desc: 'GDPR, HIPAA, CCPA, Privacy Act, APRA-aligned — configurable consent management, full audit trails, and retention controls', color: COLORS.operations },
  { icon: Globe,          label: 'Private Deployment',        desc: 'On-premises or client-managed cloud — zero data to external LLMs. No OpenAI, Google, or Anthropic routing. Zero model training risk', color: COLORS.compliance },
  { icon: Clock,          label: 'Always-On 24/7',            desc: 'Unlike human contact centres, AI agents handle calls nights, weekends, and holidays — zero after-hours drop-off, zero overtime cost', color: '#ec4899' },
];

// ── Platform screenshots ─────────────────────────────────────────────────────────
const screenshots = [
  {
    src: '/screenshots/platform-operations-dashboard.jpeg',
    thumb: '/screenshots/platform-operations-dashboard.jpeg',
    title: 'Operations Dashboard',
    desc: '179 calls last month (+202%), 12 meetings booked (+450%), hourly call distribution and SMS campaign tracking — full operational visibility in real time.',
    tag: 'Live Dashboard',
    tagColor: COLORS.compute,
  },
  {
    src: '/screenshots/platform-analytics-agent.jpeg',
    thumb: '/screenshots/platform-analytics-agent.jpeg',
    title: 'AI Analytics Agent',
    desc: 'Ask the AI for a call summary and receive a structured executive report with sentiment analysis, transfer rates, and recommended actions — generated on demand via natural language.',
    tag: 'AI Reporting',
    tagColor: COLORS.operations,
  },
  {
    src: '/screenshots/platform-phone-agents.jpeg',
    thumb: '/screenshots/platform-phone-agents.jpeg',
    title: 'Multi-Agent Configuration',
    desc: 'Multiple concurrent AI agents — Jess (outbound), Sales Agent Pro, Debt Collector, Trade SMS — each with their own persona, phone number, provider, and compliance rules.',
    tag: 'Agent Management',
    tagColor: COLORS.gtm,
  },
  {
    src: '/screenshots/platform-system-analysis.jpeg',
    thumb: '/screenshots/platform-system-analysis.jpeg',
    title: 'System Analysis & Reseller Portal',
    desc: 'Revenue vs cost per company, call vs SMS volume breakdown, top companies by revenue, and margin distribution — white-label ready for channel partners.',
    tag: 'Reseller Module',
    tagColor: COLORS.compliance,
  },
  {
    src: '/screenshots/platform-flow-editor.jpeg',
    thumb: '/screenshots/platform-flow-editor.jpeg',
    title: 'Visual Flow Designer',
    desc: 'Drag-and-drop node canvas for configuring full agent conversation flows — greeting, assist caller, take message, after hours, book/cancel appointment, transfer, wrap-up. No coding required.',
    tag: 'Flow Editor',
    tagColor: COLORS.product,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────────
function fmtAUD(n: number) {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : `$${(n / 1_000).toFixed(0)}k`;
}
function fmtFull(n: number) {
  return '$' + n.toLocaleString('en-AU');
}

interface PieLabelProps {
  cx?: number; cy?: number; midAngle?: number; innerRadius?: number;
  outerRadius?: number; pct?: number;
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
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const activeCategory = activeKey ? allocation.find(a => a.key === activeKey) : null;
  const activeBreakdown = activeKey ? (breakdowns[activeKey] ?? []) : [];

  // Lightbox keyboard nav
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const prevImg = useCallback(() => setLightboxIdx(i => i === null ? null : (i - 1 + screenshots.length) % screenshots.length), []);
  const nextImg = useCallback(() => setLightboxIdx(i => i === null ? null : (i + 1) % screenshots.length), []);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     closeLightbox();
      if (e.key === 'ArrowLeft')  prevImg();
      if (e.key === 'ArrowRight') nextImg();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIdx, closeLightbox, prevImg, nextImg]);

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <p className="text-xs text-violet-400 uppercase tracking-widest font-semibold mb-1">Seed Round</p>
          <h1 className="text-2xl font-bold text-gray-100 leading-tight">Use of Proceeds — Next Raise</h1>
          <p className="text-gray-400 text-sm mt-1">
            Seeking $1,200,000 · Voice AI Solutions Pty Ltd · How this capital will be deployed
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
          { label: 'Seed Raise Target',  value: '$1.20M',    sub: 'minimum raise $600k',              icon: DollarSign,  color: 'text-violet-400',  bg: 'bg-violet-950/30 border-violet-800/50' },
          { label: 'Live Call Volume',   value: '14,000+',   sub: 'calls handled per month today',    icon: Phone,       color: 'text-blue-400',    bg: 'bg-blue-950/30 border-blue-800/50' },
          { label: 'ARR Target',         value: '$2.5–3M',   sub: '12–18 months post-raise',          icon: Target,      color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-800/50' },
          { label: 'Team Growth',        value: '4 → 12',    sub: 'FTEs over deployment period',      icon: Users,       color: 'text-amber-400',   bg: 'bg-amber-950/30 border-amber-800/50' },
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

      {/* ── Achievements So Far ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Achievements So Far</h2>
          <p className="text-xs text-gray-500 mt-0.5">Built from scratch in 6 months · 4-person team · zero external funding</p>
        </div>

        {/* Live traction metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: '10,000+', label: 'Calls/month', sub: 'Non-medical deployments', color: COLORS.gtm },
            { value: '4,000',   label: 'Calls/month', sub: 'Medical AI receptionist (Western Sydney)', color: COLORS.product },
            { value: '0',       label: 'Compliance incidents', sub: 'Across all live deployments', color: COLORS.operations },
            { value: '4',       label: 'Active verticals', sub: 'Healthcare, debt, RE & beyond', color: COLORS.compliance },
          ].map(m => (
            <div key={m.label} className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
              <p className="text-xs font-medium text-gray-300 mt-0.5">{m.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* 6-Month execution timeline */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">6-Month Execution Timeline</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {executionTimeline.map((item, i) => (
              <div key={i} className="flex gap-3 bg-gray-800/40 border border-gray-700/40 rounded-lg p-3.5">
                <div className="shrink-0 mt-0.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: `hsl(${260 - i * 30}, 70%, 55%)` }}>
                    {i + 1}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide">{item.month}</span>
                    <span className="text-xs font-semibold text-gray-200">{item.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform capabilities */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Live Platform Capabilities</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {platformFeatures.map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="bg-gray-800/40 border border-gray-700/40 rounded-lg p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: color + '20' }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-200 leading-tight">{label}</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Competitive position callout */}
        <div className="bg-gradient-to-r from-violet-950/40 to-transparent border border-violet-800/30 rounded-lg p-4">
          <p className="text-xs font-semibold text-violet-300 mb-2">Unique Competitive Position</p>
          <p className="text-sm text-gray-300 leading-relaxed">
            The only enterprise-grade AI call centre platform with <span className="text-white font-medium">fully private deployment</span>, <span className="text-white font-medium">zero external LLM dependency</span>, and <span className="text-white font-medium">compliance-first architecture</span> — proven in the world&apos;s hardest regulated environments: healthcare and debt collection.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['vs Google CCAI', 'vs Amazon Connect', 'vs Genesys AI', 'vs Five9', 'vs Nuance (Microsoft)'].map(c => (
              <span key={c} className="text-[10px] bg-gray-800 border border-gray-700 rounded-full px-2.5 py-0.5 text-gray-400">
                {c} <span className="text-emerald-400 font-semibold">✓ private</span>
              </span>
            ))}
          </div>
        </div>

        {/* Platform screenshots gallery */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Platform Screenshots — Live Product</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {screenshots.map((s, i) => (
              <button
                key={i}
                onClick={() => setLightboxIdx(i)}
                className="group relative overflow-hidden rounded-xl border border-gray-700/60 hover:border-gray-500 transition-all text-left bg-gray-800/40 hover:bg-gray-800/70 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={s.thumb}
                    alt={s.title}
                    fill
                    className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 rounded-full p-2.5">
                      <Maximize2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.tagColor + '20', color: s.tagColor }}>
                      {s.tag}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-gray-200">{s.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Capital allocation ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-200">How the $1.2M Will Be Deployed</h2>
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
                    setActiveKey(prev => prev === k ? null : (k ?? null));
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
                  formatter={(v) => [fmtFull(Number(v ?? 0)), 'Amount']}
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-center text-xs text-gray-500 -mt-2">Total raise: $1,200,000</p>
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
                    isActive ? 'border-gray-600 bg-gray-800' : 'border-gray-800 hover:border-gray-700 hover:bg-gray-800/50',
                    !isActive && activeKey && 'opacity-50',
                  )}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <Icon className="w-4 h-4 shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-200 font-medium truncate">{a.label}</span>
                      <span className="text-xs font-bold shrink-0" style={{ color: a.color }}>{a.pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${a.pct}%`, background: a.color }} />
                    </div>
                  </div>
                  <span className="text-sm font-mono font-semibold text-gray-300 shrink-0">{fmtFull(a.amount)}</span>
                  {isActive
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
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
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height={Math.max(240, activeBreakdown.length * 36)}>
                <BarChart data={activeBreakdown} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                  <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" stroke="#6b7280"
                    tick={{ fontSize: 11, fill: '#9ca3af' }} width={160} />
                  <Tooltip
                    formatter={(v) => [fmtFull(Number(v ?? 0)), 'Amount']}
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8 }}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} fill={activeCategory.color} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>

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

      {/* ── Milestones accordion with cost breakdown ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-200">Deployment Timeline, Milestones & Spend</h2>
          <p className="text-xs text-gray-500 mt-0.5">Click a phase to see milestones and the cost breakdown for that period</p>
        </div>

        {/* Phase connector bar */}
        <div className="hidden sm:flex items-center mb-6 gap-0">
          {phases.map((ph, i) => (
            <div key={i} className="flex-1 flex items-center">
              <button
                onClick={() => setExpandedPhase(prev => prev === i ? null : i)}
                className="flex-1 relative"
              >
                <div className="h-2.5 rounded-full transition-all"
                  style={{ background: ph.color, opacity: expandedPhase === null || expandedPhase === i ? 1 : 0.35 }} />
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
            const phaseTotal = ph.costs.reduce((s, c) => s + c.amount, 0);
            return (
              <div key={i} className="border rounded-xl overflow-hidden transition-all"
                style={{ borderColor: isOpen ? ph.color + '60' : '#374151' }}>
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
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700/60 text-gray-400">
                        burn: {ph.burnEstimate}
                      </span>
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-800">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">

                      {/* Milestones */}
                      <div className="px-5 py-4">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Key Milestones</p>
                        <ul className="space-y-2">
                          {ph.milestones.map((m, mi) => (
                            <li key={mi} className="flex items-start gap-2.5">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: ph.color }} />
                              <span className="text-sm text-gray-300">{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Cost breakdown */}
                      <div className="px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Cost Breakdown</p>
                          <span className="text-xs font-mono font-bold text-gray-400">≈ {fmtFull(phaseTotal)}</span>
                        </div>
                        <div className="space-y-1.5">
                          {ph.costs.map((c, ci) => (
                            <div key={ci} className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-gray-400 truncate">{c.label}</span>
                                  <span className="text-xs font-mono font-semibold shrink-0 text-gray-300">{fmtFull(c.amount)}</span>
                                </div>
                                {/* mini bar */}
                                <div className="mt-0.5 h-1 bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{
                                    width: `${(c.amount / phaseTotal) * 100}%`,
                                    background: c.color,
                                    opacity: 0.7,
                                  }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-700/50 flex items-center justify-between">
                          <span className="text-[10px] text-gray-500">* estimates based on phase timing</span>
                          <span className="text-xs font-bold font-mono" style={{ color: ph.color }}>{fmtFull(phaseTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ARR Trajectory ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-200">Projected ARR Trajectory</h2>
          <p className="text-xs text-gray-500 mt-0.5">Projected from raise close · full $1.2M raise deployed per plan · target $3.5M+ at month 18</p>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={arrTrajectory} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="arrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
            <Tooltip
              formatter={(v) => [fmtFull(Number(v ?? 0)), 'Projected ARR']}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8 }}
            />
            <Area type="monotone" dataKey="arr" stroke="#8b5cf6" fill="url(#arrGrad)" strokeWidth={2.5}
              dot={{ fill: '#8b5cf6', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#a78bfa' }} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: 'Raise Close', value: 'Early stage', color: '#6b7280' },
            { label: 'Month 6',     value: '$900k',        color: '#3b82f6' },
            { label: 'Month 12',    value: '$2.2M',        color: '#10b981' },
            { label: 'Month 18',    value: '$3.5M+',       color: '#8b5cf6' },
            { label: 'Post Series A', value: '$6–8M',      color: '#f59e0b' },
          ].map(chip => (
            <div key={chip.label} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: chip.color }} />
              <span className="text-xs text-gray-400">{chip.label}</span>
              <span className="text-xs font-bold" style={{ color: chip.color }}>{chip.value}</span>
            </div>
          ))}
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
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v, name) => [
                    `$${Number(v ?? 0).toLocaleString()}/mo`,
                    name === 'fullRaise' ? 'Full $1.2M raise' : 'Min $600k raise',
                  ]}
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8 }}
                />
                <Legend
                  formatter={(v) => v === 'fullRaise' ? 'Full $1.2M raise' : 'Min $600k raise'}
                  wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
                />
                <Bar dataKey="fullRaise" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={60} />
                <Bar dataKey="minRaise"  fill="#374151" radius={[3, 3, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:w-52 shrink-0">
            {[
              { label: 'Static runway (full raise)', value: '~43 months', sub: 'at current $28k/mo burn', color: '#8b5cf6' },
              { label: 'Static runway (min raise)',  value: '~21 months', sub: 'at current $28k/mo burn', color: '#6b7280' },
              { label: 'Peak burn (months 4–6)',     value: '$95–110k/mo', sub: 'full headcount period',   color: '#ef4444' },
              { label: 'Cash-flow neutral target',   value: 'Month 10–12', sub: 'ARR offsetting burn',    color: '#10b981' },
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
          <h2 className="text-sm font-semibold text-gray-200">Expected Outcomes — 12 to 18 Months Post-Raise</h2>
          <p className="text-xs text-gray-500 mt-0.5">Upon full deployment of the $1.2M seed raise</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: TrendingUp,
              label: 'Revenue & Growth',
              color: '#10b981',
              points: [
                'ARR $2.5M–$3.0M (significant growth from raise close)',
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
                'Dedicated AU GPU infrastructure with data sovereignty',
              ],
            },
            {
              icon: Scale,
              label: 'Series A Position',
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

      {/* ── Lightbox ── */}
      {lightboxIdx !== null && (() => {
        const s = screenshots[lightboxIdx];
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={closeLightbox}
          >
            {/* Close */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800/80 border border-gray-700 rounded-full px-3 py-1 text-xs text-gray-300">
              {lightboxIdx + 1} / {screenshots.length}
            </div>

            {/* Prev */}
            <button
              onClick={(e) => { e.stopPropagation(); prevImg(); }}
              className="absolute left-3 sm:left-6 p-2.5 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Next */}
            <button
              onClick={(e) => { e.stopPropagation(); nextImg(); }}
              className="absolute right-3 sm:right-6 p-2.5 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white transition-colors z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Image + caption */}
            <div
              className="flex flex-col items-center max-w-6xl w-full mx-4 sm:mx-16"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
                <Image
                  src={s.src}
                  alt={s.title}
                  width={2000}
                  height={1100}
                  className="w-full h-auto object-contain max-h-[75vh]"
                  priority
                />
              </div>
              <div className="mt-4 text-center px-4">
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.tagColor + '25', color: s.tagColor }}>
                    {s.tag}
                  </span>
                  <span className="text-sm font-semibold text-gray-200">{s.title}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">{s.desc}</p>
              </div>
              {/* Thumbnail strip */}
              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {screenshots.map((t, ti) => (
                  <button
                    key={ti}
                    onClick={() => setLightboxIdx(ti)}
                    className={cn(
                      'relative shrink-0 w-16 h-10 rounded-md overflow-hidden border-2 transition-all',
                      ti === lightboxIdx ? 'border-violet-500 opacity-100' : 'border-gray-700 opacity-50 hover:opacity-75',
                    )}
                  >
                    <Image src={t.thumb} alt={t.title} fill className="object-cover object-top" sizes="64px" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Footer callout ── */}
      <div className="bg-gradient-to-r from-violet-950/40 via-violet-900/20 to-transparent border border-violet-800/30 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-200 leading-snug">
              Built, deployed, and operating in the world&apos;s most regulated industries — in 6 months, with a 4-person team.
            </p>
            <p className="text-xs text-gray-500 mt-1.5">
              This $1.2M seed raise will transform early traction into a durable, scalable revenue engine and position Voice AI Solutions
              as the leading private AI call centre platform for enterprise clients in Australia and beyond.
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
