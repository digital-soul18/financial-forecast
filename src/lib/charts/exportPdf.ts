/**
 * PDF export helpers for Charts page tables.
 * Uses jsPDF + jspdf-autotable, dynamically imported to keep the initial bundle small.
 */

import type { RowInput } from 'jspdf-autotable';

// ─── Public data types ───────────────────────────────────────────────────────

export interface PdfCategoryRow {
  label: string;
  isExpense: boolean;
  byMonth: number[];
  total: number;
  subcats: { label: string; byMonth: number[]; total: number }[];
}

export interface PdfBreakdownRow {
  label: string;
  isExpense: boolean;
  total: number;
  count: number;
  subcats: { label: string; total: number; count: number }[];
}

export interface PdfBsMonthRow {
  mo: string;
  cashBySrc: Record<string, number | null>;
  totalCash: number | null;
  retainedEarnings: number;
}

// ─── Internal type aliases ───────────────────────────────────────────────────

type RGB = [number, number, number];

interface CellStyles {
  fillColor?: RGB;
  textColor?: RGB;
  fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic';
  fontSize?: number;
  halign?: 'left' | 'center' | 'right';
  cellPadding?: number;
  lineWidth?: number;
}

/** A typed cell that jspdf-autotable accepts. colSpan lives at top-level, NOT inside styles. */
interface PdfCell {
  content: string | number;
  colSpan?: number;
  styles?: CellStyles;
}

type PdfRow = (string | number | PdfCell)[];

// ─── Formatting ──────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtAmt(n: number): string {
  if (n === 0) return '—';
  return n < 0 ? `($${fmt(n)})` : `$${fmt(n)}`;
}

function fmtMo(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} '${String(y).slice(2)}`;
}

function fmtPeriod(cols: string[]): string {
  if (!cols.length) return '';
  return cols.length === 1 ? fmtMo(cols[0]) : `${fmtMo(cols[0])} – ${fmtMo(cols[cols.length - 1])}`;
}

// ─── Colour palette (light theme — prints well) ──────────────────────────────

const C = {
  hdrBg:      [24, 24, 40]   as RGB,
  hdrText:    [255, 255, 255] as RGB,
  revBg:      [240, 253, 244] as RGB,
  revText:    [20, 83, 45]   as RGB,
  expBg:      [254, 242, 242] as RGB,
  expText:    [153, 27, 27]  as RGB,
  assetBg:    [239, 246, 255] as RGB,
  assetText:  [29, 78, 216]  as RGB,
  equityBg:   [245, 243, 255] as RGB,
  equityText: [109, 40, 217] as RGB,
  totalBg:    [229, 231, 235] as RGB,
  netPosBg:   [209, 250, 229] as RGB,
  netPosText: [21, 128, 61]  as RGB,
  netNegBg:   [254, 226, 226] as RGB,
  netNegText: [185, 28, 28]  as RGB,
  rowAlt:     [249, 250, 251] as RGB,
  ink:        [30, 27, 46]   as RGB,
  muted:      [107, 114, 128] as RGB,
};

// ─── Cell / row helpers ───────────────────────────────────────────────────────

function cell(
  content: string | number,
  opts: CellStyles & { colSpan?: number } = {},
): PdfCell {
  const { colSpan, ...styles } = opts;
  return { content, ...(colSpan != null ? { colSpan } : {}), styles };
}

/** Full-width section header row (e.g. "REVENUE"). */
function sectionRow(label: string, cols: number, bg: RGB, fg: RGB): PdfRow {
  return [cell(label.toUpperCase(), {
    colSpan: cols,
    fillColor: bg,
    textColor: fg,
    fontStyle: 'bold',
    fontSize: 7.5,
  })];
}

/** Empty spacer row. */
function spacerRow(cols: number): PdfRow {
  return [cell('', { colSpan: cols, cellPadding: 1, lineWidth: 0 })];
}

// ─── Document creation ────────────────────────────────────────────────────────

async function createDoc(title: string, subtitle: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.width;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.ink);
  doc.text('Voice AI Solutions', 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.muted);
  doc.text(title, 14, 21);
  doc.text(subtitle, 14, 26);

  const genDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFontSize(8);
  doc.text(`Generated ${genDate}`, W - 14, 14, { align: 'right' });

  doc.setDrawColor(200, 200, 215);
  doc.line(14, 29, W - 14, 29);

  return { doc, autoTable, startY: 33 };
}

const tableDefaults = {
  styles: {
    fontSize: 8,
    cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
    lineColor: [215, 215, 225] as RGB,
    lineWidth: 0.1,
    textColor: C.ink,
  },
  headStyles: {
    fillColor: C.hdrBg,
    textColor: C.hdrText,
    fontStyle: 'bold' as const,
    fontSize: 8,
  },
  alternateRowStyles: { fillColor: C.rowAlt },
  margin: { left: 14, right: 14 },
};

// ─── P&L Export ───────────────────────────────────────────────────────────────

export async function exportPlPdf(opts: {
  monthCols: string[];
  revRows: PdfCategoryRow[];
  expRows: PdfCategoryRow[];
  revByMonth: number[];
  expByMonth: number[];
  netByMonth: number[];
  totalRev: number;
  totalExp: number;
  totalNet: number;
}): Promise<void> {
  const { monthCols, revRows, expRows, revByMonth, expByMonth, netByMonth, totalRev, totalExp, totalNet } = opts;
  const { doc, autoTable, startY } = await createDoc(
    'Profit & Loss Statement',
    `Period: ${fmtPeriod(monthCols)}`,
  );

  const ncols = monthCols.length + 2; // label + months + Total
  const head = [['', ...monthCols.map(fmtMo), 'Total']];
  const body: RowInput[] = [];

  // Revenue
  body.push(sectionRow('Revenue', ncols, C.revBg, C.revText) as RowInput);
  for (const row of revRows) {
    body.push([row.label, ...row.byMonth.map(a => a === 0 ? '—' : `$${fmt(a)}`), row.total === 0 ? '—' : `$${fmt(row.total)}`] as RowInput);
    for (const sub of row.subcats) {
      body.push([
        cell(`    ${sub.label}`, { textColor: C.muted, fontSize: 7.5 }),
        ...sub.byMonth.map(a => cell(a === 0 ? '—' : `$${fmt(a)}`, { textColor: C.muted, fontSize: 7.5 })),
        cell(sub.total === 0 ? '—' : `$${fmt(sub.total)}`, { textColor: C.muted, fontSize: 7.5 }),
      ] as RowInput);
    }
  }
  if (!revRows.length) body.push([cell('No revenue in this period', { colSpan: ncols, textColor: C.muted, fontStyle: 'italic' })] as RowInput);

  body.push([
    cell('Total Revenue', { fillColor: C.revBg, textColor: C.revText, fontStyle: 'bold' }),
    ...revByMonth.map(a => cell(a === 0 ? '—' : `$${fmt(a)}`, { fillColor: C.revBg, textColor: C.revText, fontStyle: 'bold' })),
    cell(totalRev === 0 ? '—' : `$${fmt(totalRev)}`, { fillColor: C.revBg, textColor: C.revText, fontStyle: 'bold' }),
  ] as RowInput);

  body.push(spacerRow(ncols) as RowInput);

  // Expenses
  body.push(sectionRow('Operating Expenses', ncols, C.expBg, C.expText) as RowInput);
  for (const row of expRows) {
    body.push([row.label, ...row.byMonth.map(a => a === 0 ? '—' : `$${fmt(Math.abs(a))}`), row.total === 0 ? '—' : `$${fmt(Math.abs(row.total))}`] as RowInput);
    for (const sub of row.subcats) {
      body.push([
        cell(`    ${sub.label}`, { textColor: C.muted, fontSize: 7.5 }),
        ...sub.byMonth.map(a => cell(a === 0 ? '—' : `$${fmt(Math.abs(a))}`, { textColor: C.muted, fontSize: 7.5 })),
        cell(sub.total === 0 ? '—' : `$${fmt(Math.abs(sub.total))}`, { textColor: C.muted, fontSize: 7.5 }),
      ] as RowInput);
    }
  }
  if (!expRows.length) body.push([cell('No expenses in this period', { colSpan: ncols, textColor: C.muted, fontStyle: 'italic' })] as RowInput);

  body.push([
    cell('Total Expenses', { fillColor: C.expBg, textColor: C.expText, fontStyle: 'bold' }),
    ...expByMonth.map(a => cell(a === 0 ? '—' : `$${fmt(a)}`, { fillColor: C.expBg, textColor: C.expText, fontStyle: 'bold' })),
    cell(totalExp === 0 ? '—' : `$${fmt(totalExp)}`, { fillColor: C.expBg, textColor: C.expText, fontStyle: 'bold' }),
  ] as RowInput);

  body.push(spacerRow(ncols) as RowInput);

  // Net
  const nBg = totalNet >= 0 ? C.netPosBg : C.netNegBg;
  const nFg = totalNet >= 0 ? C.netPosText : C.netNegText;
  body.push([
    cell('Net Profit / (Loss)', { fillColor: nBg, textColor: nFg, fontStyle: 'bold', fontSize: 9 }),
    ...netByMonth.map(n => cell(n === 0 ? '—' : fmtAmt(n), { fillColor: nBg, textColor: n < 0 ? C.netNegText : C.netPosText, fontStyle: 'bold' })),
    cell(fmtAmt(totalNet), { fillColor: nBg, textColor: nFg, fontStyle: 'bold', fontSize: 9 }),
  ] as RowInput);

  autoTable(doc, { ...tableDefaults, head, body, startY, columnStyles: { 0: { minCellWidth: 48, fontStyle: 'bold' } } });
  doc.save(`pl-statement-${monthCols[0]}-${monthCols[monthCols.length - 1]}.pdf`);
}

// ─── Balance Sheet Export ─────────────────────────────────────────────────────

export async function exportBsPdf(opts: {
  monthCols: string[];
  sources: string[];
  data: PdfBsMonthRow[];
  fmtSource: (src: string) => string;
}): Promise<void> {
  const { monthCols, sources, data, fmtSource } = opts;
  const { doc, autoTable, startY } = await createDoc(
    'Balance Sheet',
    `Month-end snapshots: ${fmtPeriod(monthCols)}`,
  );

  const ncols = monthCols.length + 1;
  const head = [['', ...monthCols.map(fmtMo)]];
  const body: RowInput[] = [];

  // Assets
  body.push(sectionRow('Assets', ncols, C.assetBg, C.assetText) as RowInput);
  for (const src of sources) {
    body.push([
      fmtSource(src),
      ...data.map(row => {
        const v = row.cashBySrc[src];
        return v == null ? '—' : fmtAmt(v);
      }),
    ] as RowInput);
  }
  body.push([
    cell('Total Assets', { fillColor: C.assetBg, textColor: C.assetText, fontStyle: 'bold' }),
    ...data.map(row => cell(
      row.totalCash == null ? '—' : fmtAmt(row.totalCash),
      { fillColor: C.assetBg, textColor: C.assetText, fontStyle: 'bold' },
    )),
  ] as RowInput);

  body.push(spacerRow(ncols) as RowInput);

  // Equity
  body.push(sectionRow('Equity', ncols, C.equityBg, C.equityText) as RowInput);
  body.push(['Retained Earnings', ...data.map(row => fmtAmt(row.retainedEarnings))] as RowInput);
  body.push([
    cell('Total Equity', { fillColor: C.equityBg, textColor: C.equityText, fontStyle: 'bold' }),
    ...data.map(row => cell(
      fmtAmt(row.retainedEarnings),
      { fillColor: C.equityBg, textColor: row.retainedEarnings < 0 ? C.netNegText : C.equityText, fontStyle: 'bold' },
    )),
  ] as RowInput);

  autoTable(doc, { ...tableDefaults, head, body, startY, columnStyles: { 0: { minCellWidth: 48, fontStyle: 'bold' } } });
  doc.save(`balance-sheet-${monthCols[0]}-${monthCols[monthCols.length - 1]}.pdf`);
}

// ─── Monthly Spend Export ─────────────────────────────────────────────────────

export async function exportMonthlySpendPdf(opts: {
  monthCols: string[];
  rows: PdfCategoryRow[];
}): Promise<void> {
  const { monthCols, rows } = opts;
  const { doc, autoTable, startY } = await createDoc(
    'Monthly Spend by Category',
    `Period: ${fmtPeriod(monthCols)}`,
  );

  const ncols = monthCols.length + 2;
  const head = [['Category', ...monthCols.map(fmtMo), 'Total']];
  const body: RowInput[] = [];

  for (const row of rows) {
    const bg = row.isExpense ? C.expBg : C.revBg;
    const fg = row.isExpense ? C.expText : C.revText;
    body.push([
      cell(row.label, { fillColor: bg, textColor: fg, fontStyle: 'bold' }),
      ...row.byMonth.map(a => cell(a === 0 ? '—' : `$${fmt(Math.abs(a))}`, { fillColor: bg, textColor: fg, fontStyle: 'bold' })),
      cell(row.total === 0 ? '—' : `$${fmt(Math.abs(row.total))}`, { fillColor: bg, textColor: fg, fontStyle: 'bold' }),
    ] as RowInput);
    for (const sub of row.subcats) {
      body.push([
        cell(`    ${sub.label}`, { textColor: C.muted, fontSize: 7.5 }),
        ...sub.byMonth.map(a => cell(a === 0 ? '—' : `$${fmt(Math.abs(a))}`, { textColor: C.muted, fontSize: 7.5 })),
        cell(sub.total === 0 ? '—' : `$${fmt(Math.abs(sub.total))}`, { textColor: C.muted, fontSize: 7.5 }),
      ] as RowInput);
    }
  }

  const expRows = rows.filter(r => r.isExpense);
  const grandTotal = expRows.reduce((s, r) => s + Math.abs(r.total), 0);
  const grandByMonth = monthCols.map((_, i) => expRows.reduce((s, r) => s + Math.abs(r.byMonth[i]), 0));
  body.push([
    cell('Total Expenses', { fillColor: C.totalBg, fontStyle: 'bold', fontSize: 9 }),
    ...grandByMonth.map(v => cell(v === 0 ? '—' : `$${fmt(v)}`, { fillColor: C.totalBg, fontStyle: 'bold' })),
    cell(grandTotal === 0 ? '—' : `$${fmt(grandTotal)}`, { fillColor: C.totalBg, fontStyle: 'bold', fontSize: 9 }),
  ] as RowInput);

  autoTable(doc, { ...tableDefaults, head, body, startY, columnStyles: { 0: { minCellWidth: 48 } } });
  doc.save(`monthly-spend-${monthCols[0]}-${monthCols[monthCols.length - 1]}.pdf`);
}

// ─── Category Breakdown Export ────────────────────────────────────────────────

export async function exportBreakdownPdf(opts: {
  rows: PdfBreakdownRow[];
  grandExpenses: number;
  totalRevenue: number;
}): Promise<void> {
  const { rows, grandExpenses, totalRevenue } = opts;
  const { doc, autoTable, startY } = await createDoc(
    'Category & Subcategory Breakdown',
    `All transactions · ${new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}`,
  );

  const head = [['Category / Subcategory', 'Transactions', 'Amount (AUD)', '% of Spend']];
  const body: RowInput[] = [];

  for (const cat of rows) {
    const bg = cat.isExpense ? C.expBg : C.revBg;
    const fg = cat.isExpense ? C.expText : C.revText;
    const pct = grandExpenses > 0 && cat.isExpense
      ? `${((Math.abs(cat.total) / grandExpenses) * 100).toFixed(1)}%` : '—';

    body.push([
      cell(cat.label, { fillColor: bg, textColor: fg, fontStyle: 'bold' }),
      cell(String(cat.count), { fillColor: bg, textColor: fg, fontStyle: 'bold', halign: 'right' }),
      cell(cat.total < 0 ? `-$${fmt(Math.abs(cat.total))}` : `+$${fmt(cat.total)}`,
        { fillColor: bg, textColor: fg, fontStyle: 'bold', halign: 'right' }),
      cell(pct, { fillColor: bg, textColor: fg, fontStyle: 'bold', halign: 'right' }),
    ] as RowInput);

    for (const sub of cat.subcats) {
      const subPct = grandExpenses > 0 && cat.isExpense
        ? `${((Math.abs(sub.total) / grandExpenses) * 100).toFixed(1)}%` : '—';
      body.push([
        cell(`    ${sub.label}`, { textColor: C.muted, fontSize: 7.5 }),
        cell(String(sub.count), { textColor: C.muted, fontSize: 7.5, halign: 'right' }),
        cell(sub.total < 0 ? `-$${fmt(Math.abs(sub.total))}` : sub.total > 0 ? `+$${fmt(sub.total)}` : '—',
          { textColor: C.muted, fontSize: 7.5, halign: 'right' }),
        cell(subPct, { textColor: C.muted, fontSize: 7.5, halign: 'right' }),
      ] as RowInput);
    }
  }

  // Totals
  const expCount = rows.filter(c => c.isExpense).reduce((s, c) => s + c.count, 0);
  const revCount = rows.filter(c => !c.isExpense).reduce((s, c) => s + c.count, 0);
  const net = totalRevenue - grandExpenses;
  const nBg = net >= 0 ? C.netPosBg : C.netNegBg;
  const nFg = net >= 0 ? C.netPosText : C.netNegText;

  body.push([
    cell('Total Expenses', { fillColor: C.expBg, textColor: C.expText, fontStyle: 'bold' }),
    cell(String(expCount), { fillColor: C.expBg, textColor: C.expText, fontStyle: 'bold', halign: 'right' }),
    cell(`-$${fmt(grandExpenses)}`, { fillColor: C.expBg, textColor: C.expText, fontStyle: 'bold', halign: 'right' }),
    cell('100%', { fillColor: C.expBg, textColor: C.expText, fontStyle: 'bold', halign: 'right' }),
  ] as RowInput);
  body.push([
    cell('Total Revenue', { fillColor: C.revBg, textColor: C.revText, fontStyle: 'bold' }),
    cell(String(revCount), { fillColor: C.revBg, textColor: C.revText, fontStyle: 'bold', halign: 'right' }),
    cell(`+$${fmt(totalRevenue)}`, { fillColor: C.revBg, textColor: C.revText, fontStyle: 'bold', halign: 'right' }),
    cell('—', { fillColor: C.revBg, textColor: C.revText, fontStyle: 'bold', halign: 'right' }),
  ] as RowInput);
  body.push([
    cell('Net Position', { fillColor: nBg, textColor: nFg, fontStyle: 'bold', fontSize: 9 }),
    cell('', { fillColor: nBg }),
    cell(net < 0 ? `-$${fmt(Math.abs(net))}` : `+$${fmt(net)}`,
      { fillColor: nBg, textColor: nFg, fontStyle: 'bold', fontSize: 9, halign: 'right' }),
    cell('', { fillColor: nBg }),
  ] as RowInput);

  autoTable(doc, {
    ...tableDefaults,
    head,
    body,
    startY,
    columnStyles: {
      0: { minCellWidth: 72 },
      1: { halign: 'right', minCellWidth: 28 },
      2: { halign: 'right', minCellWidth: 36 },
      3: { halign: 'right', minCellWidth: 24 },
    },
  });

  doc.save('category-breakdown.pdf');
}
