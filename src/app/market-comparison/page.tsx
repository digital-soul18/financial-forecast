'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
type Tag = 'yes' | 'no' | 'partial' | 'na';
interface Cell { tag: Tag; text: string }
interface DataRow { label: string; cells: [Cell, Cell, Cell, Cell, Cell, Cell] }
interface SectionRow { section: true; label: string }
type TableRow = SectionRow | DataRow;

// ── Data helpers ─────────────────────────────────────────────────────────────
const y  = (t: string): Cell => ({ tag: 'yes',     text: t });
const n  = (t: string): Cell => ({ tag: 'no',      text: t });
const p  = (t: string): Cell => ({ tag: 'partial', text: t });
const na = (t: string): Cell => ({ tag: 'na',      text: t });
const s  = (label: string): SectionRow => ({ section: true, label });

// Columns: [VAS, Voxworks, VOXY, AiDial, Sophiie(dim), Johnni(dim)]
const tableRows: TableRow[] = [
  s('Infrastructure'),
  { label: 'Runs on AU infrastructure',
    cells: [y('✓ Yes — AU servers'), y('✓ Sydney hosted'), y('✓ Licensed AU carrier'), y('✓ Syd / Melb / Canb'), n('✗ No — standard plans offshore'), n('✗ Not confirmed')] },
  { label: 'Data never leaves Australia',
    cells: [y('✓ Yes'), y('✓ Yes'), y('✓ Carrier obligation'), y('✓ Explicit guarantee'), n('✗ Not standard plans'), n('✗ Not confirmed')] },

  s('Legal & regulatory compliance'),
  { label: 'Privacy Act 1988 / APPs',
    cells: [y('✓ Yes'), y('✓ Yes'), y('✓ Yes (regulated telco)'), y('✓ Yes (explicit)'), n('✗ Not on standard plans'), n('✗ Not confirmed')] },
  { label: 'Health Records Act',
    cells: [y('✓ Yes'), p('~ Not explicitly stated'), p('~ Not explicitly stated'), y('✓ Yes — compliance add-on'), n('✗ Not on standard plans'), n('✗ Not confirmed')] },
  { label: 'ACMA compliance',
    cells: [y('✓ Yes'), y('✓ Yes'), y('✓ Yes (regulated RSP)'), y('✓ Yes'), na('Not stated'), na('Not stated')] },
  { label: 'PHI / PII data handling',
    cells: [y('✓ Included in base plan'), p('~ Not stated explicitly'), p('~ Basic telco obligations'), p('~ A$100/mo compliance add-on'), n('✗ Not on standard plans'), n('✗ Not disclosed')] },
  { label: 'Audit logs / retention',
    cells: [y('✓ Transcripts + recordings'), p('~ Recordings only'), p('~ Basic call logs'), y('✓ 7-yr retention (add-on)'), na('N/A — standard plans'), na('Not stated')] },

  s('Medical-specific capabilities'),
  { label: 'Medical system integrations',
    cells: [y('✓ Yes — included'), p('~ Not specifically stated'), n('✗ No'), p('~ PMS — custom quote add-on'), n('✗ None'), n('✗ None')] },
  { label: '24/7 inbound + overflow',
    cells: [y('✓ Included'), y('✓ Yes'), y('✓ Yes'), y('✓ Yes'), na('N/A — standard plans'), na('N/A')] },
  { label: 'Live call transfer',
    cells: [y('✓ Included'), y('✓ Yes'), y('✓ Yes'), y('✓ Warm + cold transfer'), na('N/A'), na('N/A')] },
  { label: 'AI CRM / dashboard',
    cells: [y('✓ Included — 1 user'), p('~ External integrations only'), p('~ Add-on (unpriced)'), p('~ Dashboard + integrations add-on'), na('N/A'), na('N/A')] },
  { label: 'Knowledge base (website)',
    cells: [y('✓ Up to 50 pages'), na('Not stated'), na('Not stated'), y('✓ Docs + website'), na('N/A'), na('N/A')] },
  { label: 'Training updates / month',
    cells: [y('✓ 3 included'), na('Not stated'), na('Not stated'), p('~ 1 free, extra charged'), na('N/A'), na('N/A')] },

  s('Pricing & commercial terms'),
  { label: 'One-time setup fee',
    cells: [y('A$599'), na('Not published'), p('A$499'), p('A$1,500 – A$3,000'), n('~A$50,000+ (AU enterprise)'), na('Not published')] },
  { label: 'Effective per-min rate',
    cells: [y('A$0.36 – 0.58/min'), y('A$0.33 – 0.50/min'), n('~A$1.67/min avg'), p('A$0.42 – 0.66/min'), na('N/A'), na('N/A')] },
  { label: 'Lock-in contract',
    cells: [na('Not stated'), na('Not stated'), n('12 months min (ETF)'), y('None — cancel anytime'), na('Enterprise terms'), na('Not stated')] },
  { label: 'Suitable for AU medical?',
    cells: [y('✓ Yes'), p('Verify requirements'), p('Basic use only'), y('✓ Yes — with add-on'), n('✗ Not on standard plans'), n('✗ No')] },
];

// ── Badge component ───────────────────────────────────────────────────────────
function Badge({ tag, text, isVas }: { tag: Tag; text: string; isVas?: boolean }) {
  if (isVas) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
        {text}
      </span>
    );
  }
  const cls: Record<Tag, string> = {
    yes:     'bg-green-900/40 text-green-400',
    no:      'bg-red-900/40 text-red-400',
    partial: 'bg-amber-900/40 text-amber-400',
    na:      'bg-gray-800 text-gray-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls[tag]}`}>
      {text}
    </span>
  );
}

// ── Cost card ─────────────────────────────────────────────────────────────────
interface CostCardProps {
  provider: string;
  hosting: 'au' | 'notau' | 'dev';
  cpc: string;
  sub: string;
  lines?: Array<{ label: string; value: string; accent?: string }>;
  total?: string;
  naNote?: string;
  winner?: boolean;
  dimmed?: boolean;
}
function CostCard({ provider, hosting, cpc, sub, lines, total, naNote, winner, dimmed }: CostCardProps) {
  const hostingBadge = hosting === 'au'
    ? <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400 font-medium">AU-hosted</span>
    : hosting === 'notau'
      ? <span className="text-[10px] px-2 py-0.5 rounded bg-red-900/50 text-red-400 font-medium">Not AU-hosted</span>
      : <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-500 font-medium">Developer API</span>;

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 transition-opacity ${
      dimmed  ? 'opacity-40 border-gray-800 bg-gray-900/50' :
      winner  ? 'border-emerald-600 bg-emerald-950/30' :
                'border-gray-700 bg-gray-900'
    }`}>
      <div>
        <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${winner ? 'text-emerald-400' : 'text-gray-400'}`}>
          {provider}
          {winner && <span className="ml-2 text-[9px] bg-emerald-800/60 text-emerald-300 px-1.5 py-0.5 rounded">your product</span>}
        </div>
        <div className="mb-1">{hostingBadge}</div>
        <div className={`text-3xl font-bold leading-none mt-2 ${dimmed ? 'text-red-400 text-xl' : winner ? 'text-emerald-300' : 'text-white'}`}>
          {cpc}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>
      </div>

      {lines && (
        <div className="border-t border-gray-700/50 pt-2.5 space-y-1.5">
          {lines.map((line, i) => (
            <div key={i} className="flex justify-between items-baseline gap-2">
              <span className="text-[11px] text-gray-500 leading-tight">{line.label}</span>
              <span className={`text-[11px] font-medium shrink-0 ${line.accent ?? 'text-gray-300'}`}>{line.value}</span>
            </div>
          ))}
          {total && (
            <div className={`flex justify-between items-baseline pt-1.5 mt-1 border-t ${winner ? 'border-emerald-700/50' : 'border-gray-700'}`}>
              <span className="text-[11px] font-semibold text-gray-300">Total monthly (yr 1)</span>
              <span className={`text-sm font-bold ${winner ? 'text-emerald-400' : 'text-white'}`}>{total}</span>
            </div>
          )}
        </div>
      )}

      {naNote && <p className="text-[11px] text-red-400/80 leading-relaxed">{naNote}</p>}
    </div>
  );
}

// ── Bar chart (CSS) ───────────────────────────────────────────────────────────
interface BarItem {
  name: string;
  yourProduct?: boolean;
  cpc: string;
  pct: number;
  monthly: string;
  color: string;
  note: string;
  na?: string;
  dim?: boolean;
}
const barItems: BarItem[] = [
  { name: 'Voice AI Solutions', yourProduct: true, cpc: 'A$1.82 / call', pct: 37, monthly: 'A$999/mo', color: '#10b981',
    note: 'Setup A$599 (lowest) · Max plan · All medical compliance included in base price' },
  { name: 'AiDial', cpc: 'A$1.87 / call', pct: 38, monthly: 'A$1,024/mo', color: '#7c6ef5',
    note: 'Setup A$3,000 · Compliance A$100/mo extra · Medical integrations on custom quote · A$3,000 setup adds A$250/mo in yr 1' },
  { name: 'Voxworks', cpc: 'A$3.64+ / call', pct: 74, monthly: 'A$2,000+/mo', color: '#3b82f6',
    note: 'Setup not published · No specific medical compliance add-on · Minimum A$24,000/yr at this volume' },
  { name: 'VOXY by Vocal', cpc: 'A$4.93 / call', pct: 100, monthly: 'A$2,709/mo', color: '#f59e0b',
    note: 'Flag fall + per-minute model becomes severely uneconomical at volume · A$32,500 annual cost' },
  { name: 'Sophiie AI', cpc: 'N/A', pct: 0, monthly: '', color: '', dim: true, note: '',
    na: 'Standard plans use offshore infrastructure. AU-compliant enterprise plan estimated at ~A$50,000+ setup — not comparable at this scale.' },
  { name: 'Johnni AI', cpc: 'N/A', pct: 0, monthly: '', color: '', dim: true, note: '',
    na: 'Data hosting location not confirmed as Australian. No medical system integrations. Cannot be assessed for healthcare compliance.' },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MarketComparisonPage() {
  const [showDimmed, setShowDimmed] = useState(false);

  const providers = [
    { name: 'Voice AI Solutions', sub: 'conversationalai.com.au', isVas: true,  dim: false },
    { name: 'Voxworks',           sub: 'voxworks.ai · Sydney',    isVas: false, dim: false },
    { name: 'VOXY by Vocal',      sub: 'vocal.com.au · AU telco',  isVas: false, dim: false },
    { name: 'AiDial',             sub: 'aidial.com.au · Sunshine Coast', isVas: false, dim: false },
    { name: 'Sophiie AI',         sub: 'Not AU-hosted (standard)', isVas: false, dim: true  },
    { name: 'Johnni AI',          sub: 'Infrastructure unconfirmed', isVas: false, dim: true },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-white">Australian Voice AI — Market Comparison</h1>
          <p className="text-gray-400 text-sm mt-1">Medical sector · Australian infrastructure &amp; compliance · Pricing at 550 calls/month</p>
        </div>
        <div className="text-xs text-gray-500 sm:text-right space-y-0.5">
          <div><span className="text-gray-400 font-medium">Prepared by</span> Voice AI Solutions Pty Ltd</div>
          <div><span className="text-gray-400 font-medium">Date</span> April 2026</div>
          <div><span className="text-gray-400 font-medium">Scenario</span> 550 calls/mo · 3 min avg · 1,650 min/mo</div>
        </div>
      </div>

      {/* ── Section 1: Compliance Table ────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">1 — Australian infrastructure &amp; compliance</span>
          <div className="flex-1 h-px bg-gray-800" />
          <button
            onClick={() => setShowDimmed(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showDimmed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showDimmed ? 'Hide' : 'Show'} non-AU providers
          </button>
        </div>

        <div className="p-3.5 bg-gray-900 border-l-2 border-emerald-500 rounded-r-lg mb-4 text-xs text-gray-400 leading-relaxed">
          <span className="text-white font-semibold">Critical for medical use:</span>{' '}
          Under the Australian Privacy Act 1988 and the Health Records Act, patient data must be handled in accordance with Australian Privacy Principles.
          Providers whose standard plans use offshore infrastructure cannot satisfy these requirements without enterprise-tier arrangements — which carry materially different pricing.
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" /> Voice AI Solutions (your product)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-700 inline-block" /> AU-hosted competitors</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-700 opacity-40 inline-block" /> Not AU-hosted by default — toggle to show</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 820 }}>
            <thead>
              <tr className="border-b-2 border-gray-600">
                <th className="text-left py-2.5 pr-4 w-44 text-gray-500 font-normal text-[11px]" />
                {/* VAS */}
                <th className="py-2.5 px-3 text-left border-t-2 border-emerald-500 bg-emerald-950/30 text-emerald-300 font-semibold">
                  Voice AI Solutions
                  <span className="block text-[10px] text-emerald-500/70 font-normal mt-0.5">conversationalai.com.au</span>
                </th>
                {/* Voxworks */}
                <th className="py-2.5 px-3 text-left text-gray-300 font-semibold">
                  Voxworks
                  <span className="block text-[10px] text-gray-500 font-normal mt-0.5">voxworks.ai · Sydney</span>
                </th>
                {/* VOXY */}
                <th className="py-2.5 px-3 text-left text-gray-300 font-semibold">
                  VOXY by Vocal
                  <span className="block text-[10px] text-gray-500 font-normal mt-0.5">vocal.com.au · AU telco</span>
                </th>
                {/* AiDial */}
                <th className="py-2.5 px-3 text-left text-gray-300 font-semibold">
                  AiDial
                  <span className="block text-[10px] text-gray-500 font-normal mt-0.5">aidial.com.au · Sunshine Coast</span>
                </th>
                {/* Sophiie — conditionally shown */}
                {showDimmed && (
                  <th className="py-2.5 px-3 text-left text-gray-600 font-semibold opacity-60">
                    Sophiie AI
                    <span className="block text-[10px] text-gray-600 font-normal mt-0.5">Not AU-hosted (standard)</span>
                  </th>
                )}
                {/* Johnni — conditionally shown */}
                {showDimmed && (
                  <th className="py-2.5 px-3 text-left text-gray-600 font-semibold opacity-60">
                    Johnni AI
                    <span className="block text-[10px] text-gray-600 font-normal mt-0.5">Infrastructure unconfirmed</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => {
                if ('section' in row) {
                  return (
                    <tr key={ri} className="bg-gray-800">
                      <td colSpan={showDimmed ? 7 : 5} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                const isEven = ri % 2 === 0;
                const rowBg = isEven ? 'bg-gray-900' : 'bg-gray-800/30';
                return (
                  <tr key={ri} className={rowBg}>
                    <td className={`py-2 pr-4 pl-2 text-gray-400 font-medium text-[11px] border-b border-gray-800/50`}>{row.label}</td>
                    {/* VAS */}
                    <td className={`py-2 px-3 border-b border-gray-800/50 ${isEven ? 'bg-emerald-950/20' : 'bg-emerald-950/30'}`}>
                      <Badge tag={row.cells[0].tag} text={row.cells[0].text} isVas />
                    </td>
                    {/* Voxworks */}
                    <td className="py-2 px-3 border-b border-gray-800/50">
                      <Badge tag={row.cells[1].tag} text={row.cells[1].text} />
                    </td>
                    {/* VOXY */}
                    <td className="py-2 px-3 border-b border-gray-800/50">
                      <Badge tag={row.cells[2].tag} text={row.cells[2].text} />
                    </td>
                    {/* AiDial */}
                    <td className="py-2 px-3 border-b border-gray-800/50">
                      <Badge tag={row.cells[3].tag} text={row.cells[3].text} />
                    </td>
                    {/* Sophiie */}
                    {showDimmed && (
                      <td className="py-2 px-3 border-b border-gray-800/50 opacity-40">
                        <Badge tag={row.cells[4].tag} text={row.cells[4].text} />
                      </td>
                    )}
                    {/* Johnni */}
                    {showDimmed && (
                      <td className="py-2 px-3 border-b border-gray-800/50 opacity-40">
                        <Badge tag={row.cells[5].tag} text={row.cells[5].text} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 2: Cost Cards ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">2 — True monthly cost at 550 calls/month (year 1)</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="p-3.5 bg-gray-900 border-l-2 border-emerald-500 rounded-r-lg mb-5 text-xs text-gray-400 leading-relaxed">
          All figures on a Year 1 basis: monthly running costs plus the one-time setup fee divided across 12 months.
          Sophiie AI and Johnni AI are excluded from cost analysis — their standard plans do not run on Australian infrastructure
          and are therefore not viable for medical use without enterprise arrangements.
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <CostCard
            winner provider="Voice AI Solutions" hosting="au" cpc="A$999" sub="per month · year 1"
            lines={[
              { label: 'Max plan (1,000 min)',          value: 'A$579.00' },
              { label: 'Overage 650 min × $0.57',       value: 'A$370.50' },
              { label: 'Compliance',                     value: 'Included', accent: 'text-emerald-400' },
              { label: 'Medical integrations',           value: 'Included', accent: 'text-emerald-400' },
              { label: 'Setup A$599 ÷ 12',              value: 'A$49.92' },
            ]}
            total="A$999.42"
          />
          <CostCard
            provider="AiDial" hosting="au" cpc="A$1,025" sub="per month · year 1"
            lines={[
              { label: 'Max plan (1,200 min)',           value: 'A$499.00' },
              { label: 'Overage 450 min × $0.39',       value: 'A$175.50' },
              { label: 'Compliance add-on',              value: 'A$100.00', accent: 'text-amber-400' },
              { label: 'Medical integrations',           value: 'Custom quote', accent: 'text-amber-400' },
              { label: 'Setup A$3,000 ÷ 12',            value: 'A$250.00' },
            ]}
            total="A$1,024.50"
          />
          <CostCard
            provider="Voxworks" hosting="au" cpc="A$2,000+" sub="per month · yr 1 (setup unknown)"
            lines={[
              { label: 'Professional (6,000 min)',       value: 'A$2,000.00' },
              { label: 'Overage',                        value: 'Included' },
              { label: 'Compliance',                     value: 'Not stated', accent: 'text-gray-500' },
              { label: 'Setup (not published)',           value: 'Unknown', accent: 'text-gray-500' },
            ]}
            total="A$2,000+"
          />
          <CostCard
            provider="VOXY by Vocal" hosting="au" cpc="A$2,709" sub="per month · year 1"
            lines={[
              { label: 'Access fee',                     value: 'A$55.00' },
              { label: 'Flag fall 550 × $0.25',         value: 'A$137.50' },
              { label: 'Per-min 1,650 × $1.50',         value: 'A$2,475.00', accent: 'text-red-400' },
              { label: 'Setup A$499 ÷ 12',              value: 'A$41.58' },
            ]}
            total="A$2,709.08"
          />
          <CostCard
            dimmed provider="Sophiie AI" hosting="notau" cpc="N/A" sub="Standard plans not AU-compliant"
            naNote="AU enterprise plan: ~A$50,000+ setup. Not comparable at this scale for medical use."
          />
          <CostCard
            dimmed provider="Johnni AI" hosting="notau" cpc="N/A" sub="Infrastructure location unconfirmed"
            naNote="No confirmed AU infrastructure. No medical integrations. Cannot be considered for healthcare compliance."
          />
          <CostCard
            dimmed provider="Telnyx" hosting="dev" cpc="N/A" sub="Developer infrastructure — not a business product"
            naNote="Raw API telephony layer. No pre-built workflows, no CRM, no appointment scheduling, no medical integrations. Significant custom development required."
          />
        </div>
      </section>

      {/* ── Section 3: Bar Chart ────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">3 — Cost per call visualised (AU-compliant providers only)</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
            True cost per call at 550 calls/month · Year 1 · Setup fee included · Medical compliance included where applicable
          </p>

          {barItems.map((item, i) => (
            <div key={i} className={item.dim ? 'opacity-40' : ''}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-medium text-white flex items-center gap-2">
                  {item.name}
                  {item.yourProduct && (
                    <span className="text-[10px] bg-emerald-900/60 text-emerald-400 border border-emerald-700/50 px-1.5 py-0.5 rounded font-semibold">
                      your product
                    </span>
                  )}
                </span>
                <span className={`text-sm font-bold ${
                  item.dim ? 'text-red-400' :
                  item.yourProduct ? 'text-emerald-400' : 'text-white'
                }`}>
                  {item.cpc}
                </span>
              </div>

              {item.na ? (
                <p className="text-xs text-red-400/80 italic">{item.na}</p>
              ) : (
                <>
                  <div className="h-7 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full rounded flex items-center px-3 text-[11px] font-medium whitespace-nowrap overflow-hidden"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: item.color,
                        color: item.yourProduct ? '#064e3b' : '#fff',
                      }}
                    >
                      {item.monthly} · {item.pct < 50 ? '' : item.note.split(' · ')[0]}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{item.note}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4: Human Staff Comparison ──────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">4 — AI receptionist vs full-time onshore staff member</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Human receptionist */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Onshore human receptionist</div>
            <div className="text-sm font-semibold text-white mb-4 pb-3 border-b border-gray-700">
              Full-time medical receptionist — annual cost
            </div>
            {[
              { l: 'Base salary (SEEK 2025 average)',  v: 'A$65,000' },
              { l: 'Superannuation (11.5%)',            v: 'A$7,475' },
              { l: 'Annual leave (4 weeks)',            v: 'A$5,000' },
              { l: 'Sick leave (10 days average)',      v: 'A$2,500' },
              { l: 'Payroll tax NSW (~5.45%)',          v: 'A$3,543' },
              { l: 'Workers compensation (~2%)',        v: 'A$1,300' },
              { l: 'Recruitment / advertising',        v: 'A$2,500' },
              { l: 'Training & onboarding',            v: 'A$1,500' },
              { l: 'Leave cover (casual staff)',        v: 'A$3,000' },
              { l: 'Coverage after hours / weekends',  v: 'Not included', accent: 'text-red-400' },
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-baseline py-1.5 border-b border-gray-800/50 last:border-0">
                <span className="text-xs text-gray-500">{row.l}</span>
                <span className={`text-xs font-medium ${row.accent ?? 'text-gray-300'}`}>{row.v}</span>
              </div>
            ))}
            <div className="flex justify-between items-baseline mt-3 pt-3 border-t-2 border-gray-600">
              <span className="text-sm font-semibold text-white">Total annual cost (yr 1)</span>
              <span className="text-xl font-bold text-red-400">A$91,818</span>
            </div>
          </div>

          {/* VAS AI */}
          <div className="bg-emerald-950/30 border border-emerald-600 rounded-xl p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">Voice AI Solutions</div>
            <div className="text-sm font-semibold text-white mb-4 pb-3 border-b border-emerald-800/50">
              "Jess" AI Receptionist — annual cost
            </div>
            {[
              { l: 'Max plan subscription',             v: 'A$6,948' },
              { l: 'Overage at 550 calls/mo avg',       v: 'A$4,446' },
              { l: 'Compliance',                        v: 'A$0 — included', accent: 'text-emerald-400' },
              { l: 'Superannuation',                    v: 'A$0', accent: 'text-emerald-400' },
              { l: 'Annual leave',                      v: 'A$0', accent: 'text-emerald-400' },
              { l: 'Sick leave',                        v: 'A$0', accent: 'text-emerald-400' },
              { l: 'Payroll tax',                       v: 'A$0', accent: 'text-emerald-400' },
              { l: 'Recruitment',                       v: 'A$0', accent: 'text-emerald-400' },
              { l: 'One-time setup fee',                v: 'A$599' },
              { l: 'Coverage after hours / weekends',   v: 'Included — 24/7', accent: 'text-emerald-400' },
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-baseline py-1.5 border-b border-emerald-800/20 last:border-0">
                <span className="text-xs text-gray-500">{row.l}</span>
                <span className={`text-xs font-medium ${row.accent ?? 'text-gray-300'}`}>{row.v}</span>
              </div>
            ))}
            <div className="flex justify-between items-baseline mt-3 pt-3 border-t-2 border-emerald-600">
              <span className="text-sm font-semibold text-white">Total annual cost (yr 1)</span>
              <span className="text-xl font-bold text-emerald-400">A$11,993</span>
            </div>
          </div>
        </div>

        {/* Savings banner */}
        <div className="bg-gray-950 border border-gray-700 rounded-xl p-5 flex flex-wrap justify-between items-center gap-6">
          <div>
            <div className="text-xs text-gray-500 mb-1">Annual saving vs full-time receptionist (year 1)</div>
            <div className="text-3xl font-bold text-emerald-400">A$79,825 saved</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Cost reduction</div>
            <div className="text-3xl font-bold text-emerald-400">87%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Monthly equivalent saving</div>
            <div className="text-3xl font-bold text-emerald-400">A$6,652/mo</div>
          </div>
          <div className="max-w-xs">
            <div className="text-xs text-gray-500 mb-1">Note</div>
            <p className="text-xs text-gray-400 leading-relaxed">
              AI handles inbound, overflow, after-hours, and appointment booking 24/7.
              Human staff focus on in-clinic patient experience and clinical support tasks.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footnotes ───────────────────────────────────────────────────────── */}
      <section className="border-t border-gray-800 pt-5 space-y-1.5">
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <strong className="text-gray-500">Scenario assumptions:</strong>{' '}
          550 calls/month · 3-minute average call duration · 1,650 total minutes/month · Year 1 figures include one-time setup fee amortised over 12 months.
        </p>
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <strong className="text-gray-500">Pricing sources:</strong>{' '}
          All competitor pricing from publicly available pricing pages (April 2026). Voxworks setup fee not published — shown as unknown.
          Sophiie AI standard plan infrastructure confirmed as non-AU via company representatives; AU enterprise pricing estimated at ~A$50,000+ setup.
          Johnni AI infrastructure location not publicly disclosed.
        </p>
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <strong className="text-gray-500">Human staff costs:</strong>{' '}
          Base salary from SEEK Medical Receptionist salary data (2025 average A$60,000–A$70,000, midpoint A$65,000).
          Superannuation at current statutory rate 11.5%. Payroll tax at NSW rate applicable above threshold. Recruitment estimate based on industry average. All figures approximate.
        </p>
        <p className="text-[11px] text-gray-600 leading-relaxed">
          <strong className="text-gray-500">Disclaimer:</strong>{' '}
          Pricing correct at time of publication. Contact individual providers to confirm current rates before making purchasing decisions.
        </p>
      </section>

    </div>
  );
}
