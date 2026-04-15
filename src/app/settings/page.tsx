'use client';

import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Rule {
  id: string;
  pattern: string;
  category: string;
  subcategory: string | null;
  learnedFrom: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const { data: rules, mutate } = useSWR<Rule[]>('/api/rules', fetcher);

  const deleteRule = async (id: string) => {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-100">Settings</h1>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-300">Learned Categorisation Rules</CardTitle>
          <p className="text-xs text-gray-500">These rules were created when you answered Claude's questions. They auto-categorise matching transactions without asking again.</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">Pattern</TableHead>
                <TableHead className="text-gray-400">Category</TableHead>
                <TableHead className="text-gray-400">Subcategory</TableHead>
                <TableHead className="text-gray-400">Learned From</TableHead>
                <TableHead className="text-gray-400 w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rules ?? []).map(r => (
                <TableRow key={r.id} className="border-gray-800 hover:bg-gray-800/50">
                  <TableCell className="text-gray-200 text-sm font-mono">{r.pattern}</TableCell>
                  <TableCell className="text-gray-300 text-sm">{r.category}</TableCell>
                  <TableCell className="text-gray-400 text-sm">{r.subcategory ?? '—'}</TableCell>
                  <TableCell className="text-gray-500 text-sm truncate max-w-xs">{r.learnedFrom ?? '—'}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-500 hover:text-red-400" onClick={() => deleteRule(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(rules ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">No rules yet. Upload transactions and answer Claude's questions to create rules.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-sm text-gray-500">
        <a href="/settings/rd-config" className="text-violet-400 hover:text-violet-300">Configure R&D % by subcategory →</a>
      </div>
    </div>
  );
}
