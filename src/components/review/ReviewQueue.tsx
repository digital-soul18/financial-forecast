'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIES } from '@/lib/categoryConstants';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export interface UncertainTransaction {
  id: string;
  date: string;
  amount: number;
  transactionDetails?: string | null;
  merchantName?: string | null;
  category: string;
  subcategory: string;
  confidence: number;
  question?: string;
}

interface Props {
  transactions: UncertainTransaction[];
  onComplete: () => void;
}

export function ReviewQueue({ transactions, onComplete }: Props) {
  const [queue, setQueue] = useState(transactions.filter(t => t.question));
  const [current, setCurrent] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [saving, setSaving] = useState(false);

  const item = queue[current];
  const total = queue.length;

  if (!item || total === 0) {
    return null;
  }

  const catDef = CATEGORIES.find(c => c.slug === (selectedCategory || item.category));
  const subcats = catDef?.subcategories ?? [];

  const handleSave = async (learnRule: boolean) => {
    setSaving(true);
    const cat = selectedCategory || item.category;
    const subcat = selectedSubcategory || item.subcategory;
    const desc = item.transactionDetails || item.merchantName || '';

    if (learnRule && desc) {
      // Save pattern rule
      await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: desc.split(' ').slice(0, 3).join(' '), // first 3 words as pattern
          category: cat,
          subcategory: subcat,
          learnedFrom: desc,
          transactionId: item.id,
        }),
      });
    } else {
      // Just update this transaction
      await fetch(`/api/transactions/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: cat, subcategory: subcat }),
      });
    }

    setSaving(false);
    setSelectedCategory('');
    setSelectedSubcategory('');
    if (current + 1 >= total) {
      onComplete();
    } else {
      setCurrent(c => c + 1);
    }
  };

  const handleSkip = () => {
    if (current + 1 >= total) onComplete();
    else setCurrent(c => c + 1);
  };

  return (
    <Dialog open={true} onOpenChange={() => onComplete()}>
      <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-gray-100">
            Review Uncertain Transactions
            <Badge variant="outline" className="ml-2 text-xs border-gray-600">{current + 1} / {total}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction details */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-1">
            <p className="text-xs text-gray-500">{(() => { try { const d = new Date(item.date); return isNaN(d.getTime()) ? item.date : format(d, 'dd MMM yyyy'); } catch { return item.date; } })()}</p>
            <p className="font-medium text-gray-100">{item.merchantName || item.transactionDetails || 'Unknown'}</p>
            {item.transactionDetails && item.merchantName && (
              <p className="text-sm text-gray-400">{item.transactionDetails}</p>
            )}
            <p className={`text-lg font-semibold ${item.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {item.amount < 0 ? '-' : '+'}${Math.abs(item.amount).toFixed(2)}
            </p>
          </div>

          {/* Claude's question */}
          <div className="bg-violet-950/40 border border-violet-800 rounded-lg p-3">
            <p className="text-sm text-violet-200">
              <span className="font-medium">Claude:</span> {item.question}
            </p>
          </div>

          {/* Category picker */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <Select value={selectedCategory || item.category} onValueChange={v => { setSelectedCategory(v ?? ''); setSelectedSubcategory(''); }}>
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.slug} value={c.slug} className="text-gray-200">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Subcategory</label>
              <Select value={selectedSubcategory || item.subcategory} onValueChange={v => setSelectedSubcategory(v ?? "")}>
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {subcats.map(s => (
                    <SelectItem key={s.slug} value={s.slug} className="text-gray-200">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              onClick={() => handleSave(true)}
              disabled={saving}
            >
              Save & Remember
            </Button>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              Save Once
            </Button>
            <Button
              variant="ghost"
              className="text-gray-500"
              onClick={handleSkip}
              disabled={saving}
            >
              Skip
            </Button>
          </div>
          <p className="text-xs text-gray-500">"Save & Remember" creates a rule for future transactions like this one.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
