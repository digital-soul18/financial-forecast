import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createId } from '@paralleldrive/cuid2';

// On Railway, DATA_DIR points to the persistent volume (e.g. /data/uploads).
// Locally it defaults to uploads/ in the project root.
const ATTACHMENTS_DIR = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'attachments')
  : path.join(process.cwd(), 'uploads', 'attachments');

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachments = await prisma.transactionAttachment.findMany({
    where: { transactionId: id },
    orderBy: { uploadedAt: 'desc' },
  });
  return NextResponse.json(attachments.map(a => ({
    ...a,
    uploadedAt: a.uploadedAt instanceof Date ? a.uploadedAt.toISOString() : a.uploadedAt,
  })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 415 });
  }

  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 413 });
  }

  await fs.mkdir(ATTACHMENTS_DIR, { recursive: true });

  const fileId = createId();
  const storedPath = path.join(ATTACHMENTS_DIR, `${fileId}.pdf`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storedPath, buffer);

  const attachment = await prisma.transactionAttachment.create({
    data: {
      transactionId: id,
      filename: file.name,
      storedPath,
      fileSize: file.size,
    },
  });

  return NextResponse.json({
    ...attachment,
    uploadedAt: attachment.uploadedAt instanceof Date ? attachment.uploadedAt.toISOString() : attachment.uploadedAt,
  });
}
