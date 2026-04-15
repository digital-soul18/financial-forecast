import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'node:fs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const attachment = await prisma.transactionAttachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const buffer = fs.readFileSync(attachment.storedPath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${attachment.filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }
}
