'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface UploadResult {
  uploadId: string;
  source: string;
  inserted: number;
  matched?: number; // Wise only: NAB transactions annotated with Wise details
  skipped: number;
  uncategorized: Array<{
    id: string;
    date: string;
    amount: number;
    transactionDetails: string | null;
    merchantName: string | null;
    transactionType: string | null;
    source: string;
  }>;
}

interface Props {
  onUploadComplete: (result: UploadResult, categorizeResults: unknown[]) => void;
}

type Stage = 'idle' | 'uploading' | 'categorizing' | 'done' | 'error';

export function UploadZone({ onUploadComplete }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  const processFile = useCallback(async (file: File) => {
    setStage('uploading');
    setProgress(10);
    setError('');
    setStatusText('Parsing CSV...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const upRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!upRes.ok) {
        const e = await upRes.json();
        throw new Error(e.error ?? 'Upload failed');
      }
      const uploadResult: UploadResult = await upRes.json();
      setProgress(40);
      const matchedNote = uploadResult.matched != null && uploadResult.matched > 0
        ? ` · ${uploadResult.matched} matched to NAB transactions`
        : '';
      setStatusText(`Uploaded ${uploadResult.inserted} new transactions${matchedNote} (${uploadResult.skipped} skipped)`);

      let catResults: unknown[] = [];
      if (uploadResult.uncategorized.length > 0) {
        setStage('categorizing');
        setStatusText(`Categorising ${uploadResult.uncategorized.length} transactions with AI...`);
        setProgress(50);

        const catRes = await fetch('/api/categorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: uploadResult.uncategorized }),
        });
        const catData = await catRes.json();
        if (!catRes.ok) {
          const isKey = catData.isApiKeyError || String(catData.error).includes('API key');
          throw new Error(
            isKey
              ? 'Anthropic API key missing or invalid. Set ANTHROPIC_API_KEY in .env.local and restart the dev server, then use "Re-categorise All" to categorise these transactions.'
              : (catData.error ?? 'Categorisation failed'),
          );
        }
        catResults = catData.results ?? [];
        setProgress(95);
      }

      setProgress(100);
      setStage('done');
      const doneMatchedNote = uploadResult.matched != null && uploadResult.matched > 0
        ? ` · ${uploadResult.matched} NAB transactions annotated with Wise details`
        : '';
      setStatusText(`Done! ${uploadResult.inserted} transactions imported${doneMatchedNote}.`);
      onUploadComplete(uploadResult, catResults);
    } catch (err) {
      setStage('error');
      setError(String(err));
    }
  }, [onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
    onDropAccepted: ([file]) => processFile(file),
  });

  const isProcessing = stage === 'uploading' || stage === 'categorizing';

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-violet-500 bg-violet-950/30' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50',
          isProcessing && 'pointer-events-none opacity-60',
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 w-8 h-8 text-gray-500" />
        <p className="text-sm text-gray-300 font-medium">
          {isDragActive ? 'Drop your CSV here' : 'Drag & drop a CSV file here'}
        </p>
        <p className="text-xs text-gray-500 mt-1">Supports NAB and Wise exports</p>
        <Button variant="outline" size="sm" className="mt-3 border-gray-600" type="button">
          Browse files
        </Button>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-gray-400">{statusText}</p>
        </div>
      )}

      {stage === 'done' && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {statusText}
        </div>
      )}

      {stage === 'error' && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
