import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';

export const runtime = 'nodejs';

/**
 * Whitelist of downloadable signed contracts. Slug → on-disk filename +
 * human-readable name. New contracts must be added here explicitly — keeps
 * the route from serving arbitrary files via path traversal.
 */
const CONTRACTS: Record<string, { file: string; downloadName: string }> = {
  'tina-corporation': {
    file: 'tina-corporation.pdf',
    downloadName: 'AI Services Agreement - TINA Corporation (Daiman).pdf',
  },
  'infinite-broadband': {
    file: 'infinite-broadband.pdf',
    downloadName: 'AI Services Agreement - Infinite Broadband.pdf',
  },
  'chemo-at-home': {
    file: 'chemo-at-home.pdf',
    downloadName: 'AI Services Agreement - Chemo@Home.pdf',
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // Auth: route is NOT in proxy.ts PUBLIC_PREFIXES, so the proxy has already
  // verified the JWT cookie and stamped x-user-role. Admin-only.
  if (req.headers.get('x-user-role') !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  const { slug } = await params;
  const meta = CONTRACTS[slug];
  if (!meta) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'private-assets', 'contracts', meta.file);
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat) {
    return NextResponse.json({ error: `File missing on server: ${meta.file}` }, { status: 500 });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(stat.size),
      // Use RFC 5987 encoding so filenames with spaces / parens survive
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.downloadName)}`,
      'Cache-Control': 'private, no-store',
    },
  });
}
