/**
 * TEMPORARY — one-time DB upload endpoint.
 * Protected by UPLOAD_SECRET env var.
 * DELETE THIS FILE after the upload is complete.
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-upload-secret');
  if (!process.env.UPLOAD_SECRET || secret !== process.env.UPLOAD_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl.startsWith('file:')) {
    return NextResponse.json({ error: 'DATABASE_URL is not a file-based SQLite path' }, { status: 500 });
  }

  // Strip "file:" prefix to get the absolute path, e.g. /data/finance.db
  const dbPath = dbUrl.slice('file:'.length);

  const buffer = Buffer.from(await req.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: 'Empty body — did you forget --data-binary?' }, { status: 400 });
  }

  writeFileSync(dbPath, buffer);

  return NextResponse.json({ ok: true, path: dbPath, bytes: buffer.length });
}
