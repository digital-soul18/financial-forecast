import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'node:fs/promises';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const attachment = await prisma.transactionAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete file from disk
  try {
    await fs.unlink(attachment.storedPath);
  } catch { /* file might already be missing */ }

  await prisma.transactionAttachment.delete({ where: { id: attachmentId } });
  return NextResponse.json({ ok: true });
}
