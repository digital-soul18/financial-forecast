'use client';

import { useState } from 'react';
import {
  CheckCircle2, Clock, TrendingUp, DollarSign, Users,
  Phone, Building2, ChevronDown, ChevronRight, Zap,
  ArrowRight, Star, AlertCircle, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────────
interface CalcRow { label: string; value: string }

interface SignedClient {
  name: string;
  vertical: string;
  verticalColor: string;
  partner?: string;
  mrr: number;
  calculation: CalcRow[];
  notes: string;
  ratePerMin?: number;
  ratePerCall?: number;
  callsPerMonth: number;
  color: string;
  /** Slug for /api/contracts/[slug]. When set, a Download contract link is shown. */
  contractSlug?: string;
}

interface PipelineClient {
  name: string;
  vertical: string;
  verticalColor: string;
  stage: 'In Negotiation' | 'Proposal Sent' | 'In Discussion' | 'Incoming';
  estimatedMRR: number | null;
  estimatedARR: number | null;
  setupFee?: { min: number; max: number };
  notes: string;
  color: string;
  partner?: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────────
const signedClients: SignedClient[] = [
  {
    name: 'Courses4Me',
    vertical: 'Education',
    verticalColor: '#8b5cf6',
    mrr: 3500,
    ratePerMin: 0.45,
    callsPerMonth: 10000,
    color: '#8b5cf6',
    notes: 'Volume discount applied. 10,000 calls/month confirmed MRR.',
    calculation: [
      { label: 'Calls / month',    value: '10,000' },
      { label: 'Rate',             value: '$0.45 / min (volume discount)' },
      { label: 'Confirmed MRR',    value: '$3,500.00' },
    ],
  },
  {
    name: 'SKOOT',
    vertical: 'Transport & Logistics',
    verticalColor: '#3b82f6',
    mrr: 3564,
    ratePerMin: 0.45,
    callsPerMonth: 120 * 22,
    color: '#3b82f6',
    notes: '120 outbound calls/day across 22 working days per month.',
    calculation: [
      { label: 'Calls / day',      value: '120' },
      { label: 'Working days',     value: '22' },
      { label: 'Avg duration',     value: '3 min' },
      { label: 'Minutes / month',  value: '7,920 min' },
      { label: 'Rate',             value: '$0.45 / min' },
      { label: 'MRR',              value: '$3,564.00' },
    ],
  },
  {
    name: 'Blacktown Dermatology',
    vertical: 'Healthcare',
    verticalColor: '#10b981',
    partner: 'via Carbonelle Consulting',
    mrr: 4765.20,
    ratePerMin: 0.57,
    callsPerMonth: 95 * 22,
    color: '#10b981',
    notes: 'AI Medical Receptionist. Healthcare rate applies. Sourced via Carbonelle Consulting.',
    calculation: [
      { label: 'Calls / day',      value: '95' },
      { label: 'Working days',     value: '22' },
      { label: 'Avg duration',     value: '4 min' },
      { label: 'Minutes / month',  value: '8,360 min' },
      { label: 'Rate',             value: '$0.57 / min (healthcare)' },
      { label: 'MRR',              value: '$4,765.20' },
    ],
  },
  {
    name: 'Sight Specialists',
    vertical: 'Healthcare',
    verticalColor: '#06b6d4',
    mrr: 940.50,
    ratePerMin: 0.57,
    callsPerMonth: 25 * 22,
    color: '#06b6d4',
    notes: 'Ophthalmology practice. Healthcare rate applies.',
    calculation: [
      { label: 'Calls / day',      value: '25' },
      { label: 'Working days',     value: '22' },
      { label: 'Avg duration',     value: '3 min' },
      { label: 'Minutes / month',  value: '1,650 min' },
      { label: 'Rate',             value: '$0.57 / min (healthcare)' },
      { label: 'MRR',              value: '$940.50' },
    ],
  },
  {
    name: 'Sales Inc',
    vertical: 'Sales & Outreach',
    verticalColor: '#f97316',
    mrr: 900,
    ratePerCall: 0.30,
    callsPerMonth: 3000,
    color: '#f97316',
    notes: 'Flat per-call pricing. 3,000 calls/month at $0.30 per call.',
    calculation: [
      { label: 'Calls / month',    value: '3,000' },
      { label: 'Rate',             value: '$0.30 / call' },
      { label: 'MRR',              value: '$900.00' },
    ],
  },
  {
    // AI Services Agreement signed. Travel-agent voice AI ("Tina") for Smart Bunks.
    // Setup: $2,000 deposit + $3,000 after 90 days = $5,000 total (excl GST).
    // MRR shown is the committed platform floor; usage above 400 included minutes
    // is billed at $0.45/min inbound and grows the actual MRR. Call volume not yet
    // confirmed — calculation below reflects the contracted minimum.
    name: 'TINA Corporation (Daiman)',
    vertical: 'Travel & Tourism',
    verticalColor: '#0ea5e9',
    mrr: 179,
    ratePerMin: 0.45,
    callsPerMonth: 0,
    color: '#0ea5e9',
    notes: 'Voice AI travel agent "Tina" for Smart Bunks. Platform fee floor; actual MRR scales with usage above 400 included minutes.',
    contractSlug: 'tina-corporation',
    calculation: [
      { label: 'Setup fee',              value: '$5,000 ($2k deposit + $3k after 90 days)' },
      { label: 'Platform fee',           value: '$179 / month (includes 400 min)' },
      { label: 'Inbound / outbound',     value: '$0.45 / min' },
      { label: 'Call transfer',          value: '$0.05 / min' },
      { label: 'SMS',                    value: '$0.12 / message' },
      { label: 'Change requests',        value: '$160 / hour (excl GST)' },
      { label: 'Committed MRR floor',    value: '$179.00' },
    ],
  },
  {
    // AI Services Agreement signed. AI receptionist ("Jess") for ISP support flows,
    // integrated with Splynx for customer lookup + ticket creation.
    // Setup: $1,000 deposit + 5 × $1,000 instalments = $6,000 total (excl GST).
    // MRR shown is the committed platform floor; usage above 400 included minutes
    // is billed at $0.45/min and grows the actual MRR.
    name: 'Infinite Broadband',
    vertical: 'Telco / ISP',
    verticalColor: '#a855f7',
    mrr: 179,
    ratePerMin: 0.45,
    callsPerMonth: 0,
    color: '#a855f7',
    notes: 'AI receptionist "Jess" with Splynx API integration (customer lookup, ticket creation). Platform fee floor; actual MRR scales with usage.',
    contractSlug: 'infinite-broadband',
    calculation: [
      { label: 'Setup fee',              value: '$6,000 ($1k deposit + 5 × $1k monthly)' },
      { label: 'Platform fee',           value: '$179 / month (includes 400 min)' },
      { label: 'Inbound / outbound',     value: '$0.45 / min' },
      { label: 'Call transfer',          value: '$0.05 / min' },
      { label: 'SMS',                    value: '$0.12 / message' },
      { label: 'Splynx API calls',       value: 'Included in subscription' },
      { label: 'Change requests',        value: '$160 / hour (excl GST)' },
      { label: 'Committed MRR floor',    value: '$179.00' },
    ],
  },
  {
    // AI Services Agreement signed. Voice agent "PIA" for Chemo@Home (View Health
    // Pty Ltd) — in-home oncology nursing service. AI handles inbound triage
    // across multiple intent categories and routes to the right state team.
    // Setup: $2,000 (50% deposit on sign-off, 50% on go-live).
    // Platform $200/mo with 200 included minutes — REVIEWED at month 2 once real
    // call volume is confirmed, with volume discounts available.
    // MRR shown is the committed floor; usage above 200 included minutes scales
    // it at $0.45/min.
    name: 'Chemo@Home',
    vertical: 'Healthcare',
    verticalColor: '#14b8a6',
    mrr: 200,
    ratePerMin: 0.45,
    callsPerMonth: 0,
    color: '#14b8a6',
    notes: 'Voice agent "PIA" for View Health (Chemo@Home). Front-door triage across 5 intent categories. Platform fee + included minutes reviewed at month 2 with volume discounts available.',
    contractSlug: 'chemo-at-home',
    calculation: [
      { label: 'Setup fee',              value: '$2,000 (50% on sign-off, 50% on go-live)' },
      { label: 'Platform fee',           value: '$200 / month (includes 200 min)' },
      { label: 'Inbound minutes',        value: '$0.45 / min (overage)' },
      { label: 'SMS',                    value: '$0.12 / message (disabled this phase)' },
      { label: 'Change requests',        value: '$160 / hour (excl GST)' },
      { label: 'Additional training',    value: '$160 / hour (excl GST)' },
      { label: 'Month-2 review',         value: 'Volume discounts available' },
      { label: 'Committed MRR floor',    value: '$200.00' },
    ],
  },
  {
    // AI Services Agreement signed. Voice agent "Jess" for 21 Overlays — paint
    // protection / automotive aftermarket. Handles inbound product enquiries and
    // qualifies leads for manual quoting by the 21 Overlays team.
    // Setup: $2,000 ($1k deposit on signing + $1k when agent goes live).
    // Smallest platform fee in the cohort: $100/mo with 222 included minutes.
    // MRR shown is the committed floor; usage above 222 min scales at $0.45/min.
    name: '21 Overlays',
    vertical: 'Automotive Aftermarket',
    verticalColor: '#eab308',
    mrr: 100,
    ratePerMin: 0.45,
    callsPerMonth: 0,
    color: '#eab308',
    notes: 'Voice agent "Jess" for paint-protection enquiries. Inbound product Q&A + lead qualification handed off for human quoting. Lowest platform fee in the cohort.',
    contractSlug: '21-overlays',
    calculation: [
      { label: 'Setup fee',              value: '$2,000 ($1k on signing + $1k on go-live)' },
      { label: 'Platform fee',           value: '$100 / month (includes 222 min)' },
      { label: 'Inbound / outbound',     value: '$0.45 / min' },
      { label: 'Call transfer',          value: '$0.05 / min' },
      { label: 'SMS',                    value: '$0.12 / message' },
      { label: 'Change requests',        value: '$160 / hour (excl GST)' },
      { label: 'Committed MRR floor',    value: '$100.00' },
    ],
  },
];

const pipelineClients: PipelineClient[] = [
  {
    name: 'Carbonelle Consulting — 5 Sites',
    vertical: 'Healthcare',
    verticalColor: '#10b981',
    partner: 'via Carbonelle Consulting',
    stage: 'In Negotiation',
    estimatedMRR: 23826,
    estimatedARR: 23826 * 12,
    color: '#10b981',
    notes: 'Expanding the Blacktown Derma model to 5 additional clinic sites at the same rate. Each site identical to Blacktown Derma ($4,765.20/mo).',
  },
  {
    name: 'SkyCredit',
    vertical: 'Financial Services',
    verticalColor: '#f59e0b',
    stage: 'Proposal Sent',
    estimatedMRR: 5400,
    estimatedARR: 64800,
    setupFee: { min: 80000, max: 100000 },
    color: '#f59e0b',
    notes: 'Debt collection & credit management workflows. Significant one-time setup fee in addition to recurring ARR.',
  },
  {
    name: 'CollectAU',
    vertical: 'Debt Collection',
    verticalColor: '#ef4444',
    stage: 'In Discussion',
    estimatedMRR: 5400,         // 4,000 calls × 3 min est. × $0.45 — pending duration confirmation
    estimatedARR: 5400 * 12,
    color: '#ef4444',
    notes: '4,000 calls/month. Est. at 3 min avg × $0.45/min — MRR pending confirmation of avg call duration.',
  },
  {
    name: 'More prospects coming…',
    vertical: 'Various',
    verticalColor: '#6b7280',
    stage: 'Incoming',
    estimatedMRR: null,
    estimatedARR: null,
    color: '#6b7280',
    notes: 'Additional clients to be added shortly.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────────
const totalSignedMRR   = signedClients.reduce((s, c) => s + c.mrr, 0);
const totalSignedARR   = totalSignedMRR * 12;
const totalPipelineMRR = pipelineClients.reduce((s, c) => s + (c.estimatedMRR ?? 0), 0);
const totalPipelineARR = totalPipelineMRR * 12;
const skySetupMid      = (80000 + 100000) / 2;

function fmtMoney(n: number, decimals = 0) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  'In Negotiation': { label: 'In Negotiation', color: '#f59e0b', bg: '#f59e0b20' },
  'Proposal Sent':  { label: 'Proposal Sent',  color: '#8b5cf6', bg: '#8b5cf620' },
  'In Discussion':  { label: 'In Discussion',  color: '#3b82f6', bg: '#3b82f620' },
  'Incoming':       { label: 'Incoming',        color: '#6b7280', bg: '#6b728020' },
};

// ── Page ──────────────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-7xl">

      {/* ── Header ── */}
      <div>
        <p className="text-xs text-violet-400 uppercase tracking-widest font-semibold mb-1">Revenue Overview</p>
        <h1 className="text-2xl font-bold text-gray-100">Clients & Pipeline</h1>
        <p className="text-gray-400 text-sm mt-1">Signed recurring revenue and active deal pipeline</p>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Signed MRR',
            value: fmtMoney(totalSignedMRR, 2),
            sub: `${signedClients.length} active clients`,
            icon: CheckCircle2,
            color: 'text-emerald-400',
            bg: 'bg-emerald-950/30 border-emerald-800/50',
          },
          {
            label: 'Signed ARR',
            value: fmtMoney(totalSignedARR),
            sub: 'annualised from confirmed MRR',
            icon: TrendingUp,
            color: 'text-emerald-400',
            bg: 'bg-emerald-950/30 border-emerald-800/50',
          },
          {
            label: 'Pipeline MRR',
            value: fmtMoney(totalPipelineMRR),
            sub: `${pipelineClients.filter(c => c.estimatedMRR).length} deals in progress`,
            icon: Clock,
            color: 'text-amber-400',
            bg: 'bg-amber-950/30 border-amber-800/50',
          },
          {
            label: 'Pipeline ARR',
            value: fmtMoney(totalPipelineARR),
            sub: `+ up to ${fmtMoney(skySetupMid)} in setup fees`,
            icon: DollarSign,
            color: 'text-amber-400',
            bg: 'bg-amber-950/30 border-amber-800/50',
          },
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

      {/* ── Combined ARR bar ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ARR Breakdown</p>
            <p className="text-lg font-bold text-gray-100 mt-0.5">
              {fmtMoney(totalSignedARR + totalPipelineARR)}
              <span className="text-sm font-normal text-gray-500 ml-2">total if pipeline closes</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Signed {fmtMoney(totalSignedARR)}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />Pipeline {fmtMoney(totalPipelineARR)}</span>
          </div>
        </div>
        {/* Stacked bar */}
        <div className="h-4 rounded-full overflow-hidden flex bg-gray-800">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(totalSignedARR / (totalSignedARR + totalPipelineARR)) * 100}%` }}
          />
          <div
            className="h-full bg-amber-500/70 transition-all"
            style={{ width: `${(totalPipelineARR / (totalSignedARR + totalPipelineARR)) * 100}%` }}
          />
        </div>
        {/* Per-client breakdown bar */}
        <div className="mt-3 h-2 rounded-full overflow-hidden flex bg-gray-800">
          {signedClients.map(c => (
            <div
              key={c.name}
              className="h-full transition-all"
              style={{
                width: `${(c.mrr / totalSignedMRR) * (totalSignedARR / (totalSignedARR + totalPipelineARR)) * 100}%`,
                background: c.color,
              }}
              title={`${c.name}: ${fmtMoney(c.mrr * 12)}/yr`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          {signedClients.map(c => (
            <span key={c.name} className="text-[10px] text-gray-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      </div>

      {/* ── Signed clients ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-gray-200">Signed Clients</h2>
          <span className="text-xs bg-emerald-950/50 border border-emerald-800/50 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
            {signedClients.length} active · {fmtMoney(totalSignedMRR, 2)} MRR
          </span>
        </div>

        <div className="space-y-3">
          {signedClients.map((client) => {
            const isOpen = expandedClient === client.name;
            return (
              <div
                key={client.name}
                className="bg-gray-900 border rounded-xl overflow-hidden transition-all"
                style={{ borderColor: isOpen ? client.color + '60' : '#374151' }}
              >
                {/* Card header */}
                <button
                  onClick={() => setExpandedClient(isOpen ? null : client.name)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-800/40 transition-colors"
                >
                  {/* Colour dot */}
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: client.color }} />

                  {/* Name + tags */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-100">{client.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: client.verticalColor + '20', color: client.verticalColor }}>
                        {client.vertical}
                      </span>
                      {client.partner && (
                        <span className="text-[10px] text-gray-500 border border-gray-700 rounded-full px-2 py-0.5">
                          {client.partner}
                        </span>
                      )}
                      <span className="text-[10px] bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                        Live
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{client.notes}</p>
                  </div>

                  {/* Revenue */}
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold tabular-nums" style={{ color: client.color }}>
                      {fmtMoney(client.mrr, 2)}<span className="text-xs text-gray-500 font-normal">/mo</span>
                    </p>
                    <p className="text-xs text-gray-500">{fmtMoney(client.mrr * 12)} ARR</p>
                  </div>

                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                {/* Expanded calculation */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-800">
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Calculation breakdown */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Revenue Calculation</p>
                        <div className="space-y-1.5">
                          {client.calculation.map((row, i) => {
                            const isTotal = i === client.calculation.length - 1;
                            return (
                              <div
                                key={row.label}
                                className={cn(
                                  'flex items-center justify-between gap-4 text-xs',
                                  isTotal && 'mt-2 pt-2 border-t border-gray-700',
                                )}
                              >
                                <span className={isTotal ? 'text-gray-300 font-semibold' : 'text-gray-500'}>{row.label}</span>
                                <span
                                  className={cn('font-mono tabular-nums', isTotal ? 'font-bold text-sm' : 'text-gray-400')}
                                  style={isTotal ? { color: client.color } : undefined}
                                >
                                  {row.value}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Stats</p>
                        {[
                          { label: 'Calls / month',  value: client.callsPerMonth.toLocaleString() },
                          client.ratePerCall != null
                            ? { label: 'Rate / call', value: `$${client.ratePerCall.toFixed(2)}` }
                            : { label: 'Rate / min',  value: `$${client.ratePerMin!.toFixed(2)}` },
                          { label: 'Monthly revenue', value: fmtMoney(client.mrr, 2) },
                          { label: 'Annual revenue',  value: fmtMoney(client.mrr * 12) },
                        ].map(s => (
                          <div key={s.label} className="flex justify-between text-xs">
                            <span className="text-gray-500">{s.label}</span>
                            <span className="text-gray-300 font-mono">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Signed contract download — shown only when a slug is attached */}
                    {client.contractSlug && (
                      <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Signed agreement</p>
                        <a
                          href={`/api/contracts/${client.contractSlug}`}
                          className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 px-3 py-1.5 rounded-md transition-colors"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Download contract (PDF)
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Signed total row */}
        <div className="mt-3 flex items-center justify-between bg-emerald-950/20 border border-emerald-800/30 rounded-xl px-5 py-3.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-gray-200">Total Signed Recurring Revenue</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{fmtMoney(totalSignedMRR, 2)}<span className="text-sm font-normal text-gray-500">/mo</span></p>
            <p className="text-xs text-gray-500">{fmtMoney(totalSignedARR)} ARR</p>
          </div>
        </div>
      </div>

      {/* ── Pipeline ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">Deal Pipeline</h2>
          <span className="text-xs bg-amber-950/50 border border-amber-800/50 text-amber-400 px-2 py-0.5 rounded-full font-medium">
            {fmtMoney(totalPipelineMRR)} MRR potential
          </span>
        </div>

        <div className="space-y-3">
          {pipelineClients.map((deal) => {
            const stage = STAGE_META[deal.stage];
            const isEmpty = deal.estimatedMRR === null;
            return (
              <div
                key={deal.name}
                className={cn(
                  'bg-gray-900 border border-gray-800 rounded-xl px-5 py-4',
                  isEmpty && 'opacity-50',
                )}
              >
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: deal.color }} />
                      <span className="text-sm font-semibold text-gray-100">{deal.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: deal.verticalColor + '20', color: deal.verticalColor }}>
                        {deal.vertical}
                      </span>
                      {deal.partner && (
                        <span className="text-[10px] text-gray-500 border border-gray-700 rounded-full px-2 py-0.5">
                          {deal.partner}
                        </span>
                      )}
                      {/* Stage badge */}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: stage.bg, color: stage.color }}>
                        {stage.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed pl-4">{deal.notes}</p>
                  </div>

                  {/* Revenue potential */}
                  {!isEmpty && (
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold tabular-nums" style={{ color: deal.color }}>
                        {fmtMoney(deal.estimatedMRR!)}<span className="text-xs text-gray-500 font-normal">/mo</span>
                      </p>
                      <p className="text-xs text-gray-500">{fmtMoney(deal.estimatedARR!)} ARR</p>
                      {deal.setupFee && (
                        <p className="text-[10px] text-amber-400 mt-0.5">
                          + {fmtMoney(deal.setupFee.min)}–{fmtMoney(deal.setupFee.max)} setup
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Carbonelle expansion detail */}
                {deal.name.includes('Carbonelle') && (
                  <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 sm:grid-cols-3 gap-2 pl-4">
                    {[
                      { label: 'Sites', value: '5' },
                      { label: 'Per site MRR', value: '$4,765.20' },
                      { label: 'Total MRR', value: fmtMoney(deal.estimatedMRR!) },
                      { label: 'Per site ARR', value: '$57,182' },
                      { label: 'Total ARR', value: fmtMoney(deal.estimatedARR!) },
                      { label: 'Model', value: 'Blacktown Derma ×5' },
                    ].map(s => (
                      <div key={s.label} className="text-xs">
                        <span className="text-gray-600">{s.label}: </span>
                        <span className="text-gray-300 font-mono">{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* SkyCredit detail */}
                {deal.name.includes('SkyCredit') && deal.setupFee && (
                  <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 sm:grid-cols-3 gap-2 pl-4">
                    {[
                      { label: 'Recurring ARR', value: '$64,800' },
                      { label: 'Recurring MRR', value: '$5,400' },
                      { label: 'Setup fee (est.)', value: '$80k–$100k' },
                      { label: 'Total year 1', value: fmtMoney(deal.estimatedARR! + skySetupMid) },
                      { label: 'Vertical', value: 'Financial Services' },
                      { label: 'Use case', value: 'Debt collection' },
                    ].map(s => (
                      <div key={s.label} className="text-xs">
                        <span className="text-gray-600">{s.label}: </span>
                        <span className="text-gray-300 font-mono">{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CollectAU detail */}
                {deal.name === 'CollectAU' && (
                  <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 sm:grid-cols-3 gap-2 pl-4">
                    {[
                      { label: 'Calls / month',   value: '4,000' },
                      { label: 'Est. avg duration', value: '3 min (TBC)' },
                      { label: 'Rate',              value: '$0.45 / min' },
                      { label: 'Est. minutes',      value: '12,000 min' },
                      { label: 'Est. MRR',          value: '$5,400' },
                      { label: 'Est. ARR',          value: '$64,800' },
                    ].map(s => (
                      <div key={s.label} className="text-xs">
                        <span className="text-gray-600">{s.label}: </span>
                        <span className="text-gray-300 font-mono">{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pipeline total */}
        <div className="mt-3 flex items-center justify-between bg-amber-950/20 border border-amber-800/30 rounded-xl px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-sm font-semibold text-gray-200">Total Pipeline Potential</span>
              <p className="text-xs text-gray-500">Excluding one-time setup fees</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-amber-400 tabular-nums">{fmtMoney(totalPipelineMRR)}<span className="text-sm font-normal text-gray-500">/mo</span></p>
            <p className="text-xs text-gray-500">{fmtMoney(totalPipelineARR)} ARR</p>
          </div>
        </div>
      </div>

      {/* ── If all pipeline closes ── */}
      <div className="bg-gradient-to-r from-violet-950/40 via-violet-900/20 to-transparent border border-violet-800/30 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-violet-400" />
              <p className="text-sm font-semibold text-gray-200">If All Pipeline Closes</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
              {[
                { label: 'Total MRR',      value: fmtMoney(totalSignedMRR + totalPipelineMRR, 2), color: '#8b5cf6' },
                { label: 'Total ARR',      value: fmtMoney(totalSignedARR + totalPipelineARR), color: '#8b5cf6' },
                { label: 'Setup Fees',     value: '$80k–$100k', color: '#f59e0b' },
                { label: 'Year 1 Revenue', value: fmtMoney(totalSignedARR + totalPipelineARR + skySetupMid), color: '#10b981' },
              ].map(m => (
                <div key={m.label}>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">{m.label}</p>
                  <p className="text-base font-bold tabular-nums mt-0.5" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
            <ArrowRight className="w-4 h-4" />
            <span>More clients incoming</span>
          </div>
        </div>
      </div>

    </div>
  );
}
