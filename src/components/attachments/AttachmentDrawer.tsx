'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink, Upload, FileText } from 'lucide-react';
import type { TransactionAttachment } from '@/types/transaction';

interface Props {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  description?: string;
  initialAttachments?: TransactionAttachment[];
}

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function AttachmentDrawer({ open, onClose, transactionId, description, initialAttachments = [] }: Props) {
  const [attachments, setAttachments] = useState<TransactionAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/transactions/${transactionId}/attachments`, { method: 'POST', body: formData });
    if (!res.ok) {
      const e = await res.json();
      setError(e.error ?? 'Upload failed');
    } else {
      const a: TransactionAttachment = await res.json();
      setAttachments(prev => [a, ...prev]);
    }
    setUploading(false);
  }, [transactionId]);

  const deleteAttachment = async (id: string) => {
    await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    onDropAccepted: ([file]) => upload(file),
  });

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-gray-900 border-gray-700 text-gray-100 w-[420px]">
        <SheetHeader>
          <SheetTitle className="text-gray-100">Attachments</SheetTitle>
          {description && <p className="text-xs text-gray-400 truncate">{description}</p>}
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-violet-500 bg-violet-950/30' : 'border-gray-700 hover:border-gray-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto mb-2 w-5 h-5 text-gray-500" />
            <p className="text-sm text-gray-400">Drop PDF invoice here or click to browse</p>
          </div>

          {uploading && <p className="text-sm text-gray-400">Uploading...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="space-y-2">
            {attachments.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No attachments yet</p>
            )}
            {attachments.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{a.filename}</p>
                  <p className="text-xs text-gray-500">{formatSize(a.fileSize)}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 text-gray-400 hover:text-white"
                  onClick={() => window.open(`/api/attachments/${a.id}/file`, '_blank')}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7 text-gray-400 hover:text-red-400"
                  onClick={() => deleteAttachment(a.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
