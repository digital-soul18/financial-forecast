'use client';

import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORIES } from '@/lib/categoryConstants';
import { CheckCircle2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface RdConfigRow {
  category: string;
  subcategory: string;
  label: string;
  rdPercent: number;
}

export default function RdConfigPage() {
  const { data, mutate } = useSWR<RdConfigRow[]>('/api/rd-config', fetcher);
  const [values, setValues] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      const v: Record<string, number> = {};
      for (const row of data) v[`${row.category}|${row.subcategory}`] = row.rdPercent;
      setValues(v);
    }
  }, [data]);

  const handleSave = async () => {
    const updates = Object.entries(values).map(([key, rdPercent]) => {
      const [category, subcategory] = key.split('|');
      return { category, subcategory, rdPercent };
    });
    await fetch('/api/rd-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSaved(true);
    mutate();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">R&D Configuration</h1>
          <p className="text-sm text-gray-400 mt-1">Set the default R&D Tax Incentive percentage for each expense subcategory.</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700 gap-2" onClick={handleSave}>
          {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : 'Save Changes'}
        </Button>
      </div>

      {CATEGORIES.filter(c => c.isExpense).map(cat => (
        <Card key={cat.slug} className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-300">{cat.label}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {cat.subcategories.map(sub => {
              const key = `${cat.slug}|${sub.slug}`;
              const val = values[key] ?? sub.defaultRdPercent;
              return (
                <div key={sub.slug} className="flex items-center gap-4">
                  <div className="w-40 shrink-0">
                    <p className="text-sm text-gray-300">{sub.label}</p>
                    <p className="text-xs text-gray-500 truncate">{sub.examples.slice(0, 2).join(', ')}</p>
                  </div>
                  <div className="flex-1">
                    <Slider
                      min={0} max={100} step={5}
                      value={[val]}
                      onValueChange={(vals) => { const v = Array.isArray(vals) ? vals[0] : vals; setValues(prev => ({ ...prev, [key]: v ?? 0 })); }}
                      className="w-full"
                    />
                  </div>
                  <div className="w-12 text-right">
                    <span className={`text-sm font-medium ${val >= 70 ? 'text-violet-400' : val >= 30 ? 'text-amber-400' : 'text-gray-400'}`}>
                      {val}%
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
