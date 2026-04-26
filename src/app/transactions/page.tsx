'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { format } from 'date-fns';
import { UploadZone, type UploadResult } from '@/components/upload/UploadZone';
import { CategoryBadge } from '@/components/transactions/CategoryBadge';
import { AttachmentDrawer } from '@/components/attachments/AttachmentDrawer';
import { ReviewQueue, type UncertainTransaction } from '@/components/review/ReviewQueue';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select as CatSelect, SelectContent as CatContent, SelectItem as CatItem, SelectTrigger as CatTrigger, SelectValue as CatVal } from '@/components/ui/select';
import { CATEGORIES } from '@/lib/categoryConstants';
import { Paperclip, ChevronLeft, ChevronRight, FlaskConical, RefreshCw, AlertTriangle, KeyRound, Sparkles, MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { Transaction } from '@/types/transaction';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function buildUrl(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  return `/api/transactions?${q}`;
}

function TransactionsPageInner() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [glowId, setGlowId] = useState<string | null>(null);
  const [reviewQueue, setReviewQueue] = useState<UncertainTransaction[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [attachmentTx, setAttachmentTx] = useState<Transaction | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCat, setEditCat] = useState('');
  const [editSubcat, setEditSubcat] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [recatStatus, setRecatStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [recatMessage, setRecatMessage] = useState('');
  const [recatProgress, setRecatProgress] = useState({ done: 0, total: 0, batch: 0, totalBatches: 0 });

  const url = buildUrl({ category, source, search, page, limit: 50 });
  const { data, mutate } = useSWR(url, fetcher);

  const transactions: Transaction[] = data?.transactions ?? [];
  const total: number = data?.total ?? 0;
  const totalPages: number = data?.totalPages ?? 1;
  const sum: number = data?.sum ?? 0;

  // ── Jump to the right page when a highlight ID arrives from /charts ──────────
  useEffect(() => {
    if (!highlightId) return;
    fetch(`/api/transactions/locate?id=${highlightId}&limit=50`)
      .then(async r => {
        if (!r.ok) return; // transaction not found — leave page as-is
        const { page: p } = await r.json();
        if (typeof p === 'number') setPage(p);
      })
      .catch(() => {}); // network error — leave page as-is
  }, [highlightId]);

  // ── Scroll to + glow the row once it's rendered on screen ───────────────────
  useEffect(() => {
    if (!highlightId) return;
    // Small delay lets React finish painting the new page's rows before we query the DOM
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-txid="${highlightId}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setGlowId(highlightId);
      setTimeout(() => setGlowId(null), 2500);
    }, 80);
    return () => clearTimeout(timer);
  }, [highlightId, transactions]); // re-run when page data loads

  const handleUploadComplete = useCallback((_result: UploadResult, catResults: unknown[]) => {
    const uncertain = (catResults as UncertainTransaction[]).filter(r => (r as UncertainTransaction).question);
    if (uncertain.length > 0) {
      setReviewQueue(uncertain);
      setShowReview(true);
    }
    mutate();
  }, [mutate]);

  const handleRecategorize = async () => {
    setRecatStatus('running');
    setRecatMessage('Starting…');
    setRecatProgress({ done: 0, total: 0, batch: 0, totalBatches: 0 });
    try {
      const res = await fetch('/api/recategorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all' }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === 'start') {
              setRecatProgress({ done: 0, total: event.total, batch: 0, totalBatches: event.totalBatches });
              setRecatMessage(`Categorising ${event.total} transactions in ${event.totalBatches} batches of 20…`);
            } else if (event.type === 'batch_start') {
              setRecatProgress(p => ({ ...p, batch: event.batchNum }));
              setRecatMessage(`Batch ${event.batchNum}/${event.totalBatches} — asking Claude about rows ${event.rowStart}–${event.rowEnd}…`);
            } else if (event.type === 'batch_done') {
              setRecatProgress(p => ({ ...p, done: event.processed, batch: event.batchNum }));
              setRecatMessage(`Batch ${event.batchNum}/${event.totalBatches} complete · ${event.processed}/${event.total} categorised`);
            } else if (event.type === 'db_write') {
              setRecatMessage(prev => `${prev} · writing ${event.rows} rows to DB…`);
            } else if (event.type === 'batch_error') {
              if (event.isApiKeyError) {
                setRecatStatus('error');
                setRecatMessage(event.message);
                return;
              }
            } else if (event.type === 'fatal') {
              setRecatStatus('error');
              setRecatMessage(event.message);
              return;
            } else if (event.type === 'done') {
              setRecatStatus('done');
              setRecatMessage(`Done — ${event.processed} categorised${event.failed > 0 ? `, ${event.failed} failed` : ''}`);
              const uncertain = (event.uncertain ?? []) as UncertainTransaction[];
              if (uncertain.length > 0) {
                setReviewQueue(uncertain);
                setShowReview(true);
              }
              mutate();
            }
          } catch {
            // malformed JSON line — ignore
          }
        }
      }
    } catch (err) {
      setRecatStatus('error');
      setRecatMessage(String(err));
    }
  };

  const saveCategoryEdit = async (id: string) => {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: editCat, subcategory: editSubcat }),
    });
    setEditingId(null);
    mutate();
  };

  const toggleRd = async (tx: Transaction) => {
    await fetch(`/api/transactions/${tx.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rdEligible: !tx.rdEligible }),
    });
    mutate();
  };

  const saveNote = async (id: string, value: string) => {
    setEditingNoteId(null);
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: value.trim() || null }),
    });
    mutate();
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteTransaction = async (id: string) => {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    mutate();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start gap-y-2 justify-between">
        <h1 className="text-xl font-semibold text-gray-100">Transactions</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-gray-400">
            {total} txns · <span className={sum < 0 ? 'text-red-400' : 'text-emerald-400'}>${Math.abs(sum).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-violet-700 text-violet-300 hover:bg-violet-900/40 gap-2"
            onClick={handleRecategorize}
            disabled={recatStatus === 'running'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recatStatus === 'running' ? 'animate-spin' : ''}`} />
            {recatStatus === 'running' ? 'Categorising…' : 'Re-categorise All'}
          </Button>
        </div>
      </div>

      {/* Status / error banner */}
      {recatStatus === 'error' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {recatMessage.includes('API key') ? (
            <KeyRound className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
          )}
          <div>
            <p className="font-medium">{recatMessage.includes('API key') ? 'API Key not configured' : 'Categorisation error'}</p>
            <p className="text-red-400 mt-0.5">{recatMessage}</p>
            {recatMessage.includes('API key') && (
              <p className="mt-1 text-red-400/70">
                Open <code className="bg-red-900/50 px-1 rounded">.env.local</code>, set <code className="bg-red-900/50 px-1 rounded">ANTHROPIC_API_KEY=sk-ant-…</code>, then restart the dev server.
              </p>
            )}
          </div>
        </div>
      )}
      {recatStatus === 'done' && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-300">
          <RefreshCw className="w-3.5 h-3.5" />
          {recatMessage}
        </div>
      )}
      {recatStatus === 'running' && (
        <div className="rounded-lg border border-violet-800 bg-violet-950/30 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-violet-300">
            <Sparkles className="w-3.5 h-3.5 animate-pulse shrink-0" />
            <span className="flex-1">{recatMessage}</span>
            {recatProgress.total > 0 && (
              <span className="text-violet-400 font-mono text-xs tabular-nums shrink-0">
                {recatProgress.done}/{recatProgress.total}
              </span>
            )}
          </div>
          {recatProgress.total > 0 && (
            <Progress
              value={Math.round((recatProgress.done / recatProgress.total) * 100)}
              className="h-1.5 bg-violet-900"
            />
          )}
        </div>
      )}

      {/* Upload */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Import CSV</h2>
        <UploadZone onUploadComplete={handleUploadComplete} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search descriptions..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-48 bg-gray-900 border-gray-700 text-gray-200"
        />
        <Select value={category || 'all'} onValueChange={v => { setCategory(v === 'all' ? '' : (v ?? '')); setPage(1); }}>
          <SelectTrigger className="w-48 bg-gray-900 border-gray-700 text-gray-200">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all" className="text-gray-200">All categories</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c.slug} value={c.slug} className="text-gray-200">{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source || 'all'} onValueChange={v => { setSource(v === 'all' ? '' : (v ?? '')); setPage(1); }}>
          <SelectTrigger className="w-32 bg-gray-900 border-gray-700 text-gray-200">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all" className="text-gray-200">All accounts</SelectItem>
            <SelectItem value="nab" className="text-gray-200">NAB</SelectItem>
            <SelectItem value="wise" className="text-gray-200">Wise</SelectItem>
          </SelectContent>
        </Select>
        {(category || source || search) && (
          <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => { setCategory(''); setSource(''); setSearch(''); setPage(1); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800 hover:bg-transparent">
              <TableHead className="text-gray-400 w-24">Date</TableHead>
              <TableHead className="text-gray-400">Description</TableHead>
              <TableHead className="text-gray-400">Notes</TableHead>
              <TableHead className="text-gray-400">Category</TableHead>
              <TableHead className="text-gray-400 w-24 text-right">Amount</TableHead>
              <TableHead className="text-gray-400 w-10 text-center" title="R&D Eligible">
                <FlaskConical className="w-3.5 h-3.5 mx-auto" />
              </TableHead>
              <TableHead className="text-gray-400 w-10 text-center">
                <Paperclip className="w-3.5 h-3.5 mx-auto" />
              </TableHead>
              <TableHead className="text-gray-400 w-16 text-center">Acct</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map(tx => (
              <TableRow
                key={tx.id}
                data-txid={tx.id}
                className={cn(
                  'border-gray-800 hover:bg-gray-800/50 transition-colors duration-700',
                  glowId === tx.id && 'bg-violet-900/40 ring-1 ring-inset ring-violet-500',
                )}
              >
                <TableCell className="text-gray-400 text-sm">
                  {format(new Date(tx.date), 'dd MMM yy')}
                </TableCell>
                <TableCell className="text-gray-200 text-sm max-w-xs">
                  <div className="truncate">{tx.merchantName || tx.transactionDetails || '—'}</div>
                  {tx.merchantName && tx.transactionDetails && (
                    <div className="text-xs text-gray-500 truncate">{tx.transactionDetails}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm max-w-[200px]">
                  {editingNoteId === tx.id ? (
                    <input
                      autoFocus
                      className="w-full bg-gray-800 border border-violet-500 text-gray-100 text-xs px-2 py-1 rounded outline-none"
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      onBlur={e => { if (e.currentTarget.dataset.saved !== 'true') saveNote(tx.id, editNote); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.currentTarget.dataset.saved = 'true'; saveNote(tx.id, editNote); }
                        if (e.key === 'Escape') { e.currentTarget.dataset.saved = 'true'; setEditingNoteId(null); }
                      }}
                      placeholder="Add a note…"
                    />
                  ) : (
                    <div
                      className="flex items-center gap-1.5 cursor-pointer group"
                      onClick={() => { setEditingNoteId(tx.id); setEditNote(tx.notes ?? ''); }}
                      title="Click to add/edit note"
                    >
                      {tx.notes ? (
                        <span className="text-amber-300/80 text-xs truncate">{tx.notes}</span>
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 transition-colors" />
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === tx.id ? (
                    <div className="flex items-center gap-1.5">
                      <CatSelect value={editCat} onValueChange={v => { setEditCat(v ?? ''); setEditSubcat(''); }}>
                        <CatTrigger className="h-7 text-xs bg-gray-800 border-gray-600 w-32">
                          <CatVal />
                        </CatTrigger>
                        <CatContent className="bg-gray-800 border-gray-600">
                          {CATEGORIES.map(c => (
                            <CatItem key={c.slug} value={c.slug} className="text-gray-200 text-xs">{c.label}</CatItem>
                          ))}
                        </CatContent>
                      </CatSelect>
                      <CatSelect value={editSubcat} onValueChange={v => setEditSubcat(v ?? "")}>
                        <CatTrigger className="h-7 text-xs bg-gray-800 border-gray-600 w-28">
                          <CatVal />
                        </CatTrigger>
                        <CatContent className="bg-gray-800 border-gray-600">
                          {(CATEGORIES.find(c => c.slug === editCat)?.subcategories ?? []).map(s => (
                            <CatItem key={s.slug} value={s.slug} className="text-gray-200 text-xs">{s.label}</CatItem>
                          ))}
                        </CatContent>
                      </CatSelect>
                      <Button size="sm" className="h-7 px-2 bg-violet-600 hover:bg-violet-700 text-xs" onClick={() => saveCategoryEdit(tx.id)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-1 text-gray-400 text-xs" onClick={() => setEditingId(null)}>✕</Button>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer"
                      onClick={() => { setEditingId(tx.id); setEditCat(tx.category ?? ''); setEditSubcat(tx.subcategory ?? ''); }}
                      title="Click to edit"
                    >
                      <CategoryBadge category={tx.category} subcategory={tx.subcategory} confidence={tx.categoryConfidence} size="sm" />
                    </div>
                  )}
                </TableCell>
                <TableCell className={`text-right font-mono text-sm ${tx.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={tx.rdEligible}
                    onCheckedChange={() => toggleRd(tx)}
                    className="border-gray-600"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-gray-500 hover:text-gray-200"
                    onClick={() => setAttachmentTx(tx)}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {(tx.attachments?.length ?? 0) > 0 && (
                      <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-violet-500" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs border-gray-700 text-gray-400 uppercase">
                    {tx.source}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {confirmDeleteId === tx.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs bg-red-700 hover:bg-red-600 text-white"
                        onClick={() => deleteTransaction(tx.id)}
                      >
                        Delete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1 text-xs text-gray-400"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 text-gray-700 hover:text-red-400 transition-colors"
                      onClick={() => setConfirmDeleteId(tx.id)}
                      title="Delete transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-12">
                  No transactions found. Import a CSV above to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} · {total} total</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-gray-700" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" className="border-gray-700" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Attachment Drawer */}
      {attachmentTx && (
        <AttachmentDrawer
          open={true}
          onClose={() => setAttachmentTx(null)}
          transactionId={attachmentTx.id}
          description={attachmentTx.merchantName || attachmentTx.transactionDetails || undefined}
          initialAttachments={attachmentTx.attachments ?? []}
        />
      )}

      {/* Review Queue */}
      {showReview && reviewQueue.length > 0 && (
        <ReviewQueue
          transactions={reviewQueue}
          onComplete={() => { setShowReview(false); mutate(); }}
        />
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400 text-sm">Loading…</div>}>
      <TransactionsPageInner />
    </Suspense>
  );
}
