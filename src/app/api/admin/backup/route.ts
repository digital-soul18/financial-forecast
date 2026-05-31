import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import Database from 'better-sqlite3';
import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

// SQLite online-backup needs the full Node runtime (better-sqlite3 native module)
export const runtime = 'nodejs';
// Snapshots can take a few seconds for a non-trivial DB — give it room.
export const maxDuration = 60;

const COOKIE_NAME = '__auth_token';

interface JWTPayload {
  sub: string;
  email: string;
  role: 'admin' | 'contractor';
  jti: string;
}

/**
 * Authenticate the request. Two modes:
 *   1. Bearer token — used by the local cron / scheduled backup script
 *   2. Admin cookie — used by the "Download backup" button in the UI
 *
 * Both are checked here because the route is in PUBLIC_PREFIXES (proxy.ts), so
 * the middleware does not enforce auth before we get here.
 */
async function authenticate(req: NextRequest): Promise<{ ok: true; via: 'token' | 'cookie' } | { ok: false; reason: string }> {
  // (1) Bearer token path — for cron / scripts
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const expected = process.env.BACKUP_TOKEN ?? '';
  if (bearer && expected) {
    // Constant-time-ish compare via length + char compare
    if (bearer.length === expected.length) {
      let diff = 0;
      for (let i = 0; i < bearer.length; i++) diff |= bearer.charCodeAt(i) ^ expected.charCodeAt(i);
      if (diff === 0) return { ok: true, via: 'token' };
    }
    return { ok: false, reason: 'Invalid bearer token' };
  }

  // (2) Cookie path — for admin UI
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return { ok: false, reason: 'No credentials provided' };

  const secret = process.env.AUTH_SECRET;
  if (!secret) return { ok: false, reason: 'AUTH_SECRET not configured' };

  try {
    const { payload } = await jwtVerify(cookie, new TextEncoder().encode(secret));
    const p = payload as unknown as JWTPayload;
    if (p.role !== 'admin') return { ok: false, reason: 'Admin role required' };
    return { ok: true, via: 'cookie' };
  } catch {
    return { ok: false, reason: 'Invalid or expired session' };
  }
}

/** Resolve the SQLite DB file path the same way src/lib/db.ts does. */
function resolveDbPath(): string {
  const rawUrl = process.env.DATABASE_URL ?? 'file:./prisma/finance.db';
  const filePath = rawUrl.replace(/^file:/, '');
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

/** Format YYYY-MM-DD for filenames (local time). */
function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const dbPath = resolveDbPath();
  if (!(await fs.stat(dbPath).then(() => true).catch(() => false))) {
    return NextResponse.json({ error: `Source DB not found at ${dbPath}` }, { status: 500 });
  }

  // Write the snapshot to a temp file. We use the system tmpdir so it never
  // pollutes the project tree or the Railway volume.
  const tempName = `finance-backup-${todayStamp()}-${randomBytes(4).toString('hex')}.db`;
  const tempPath = path.join(os.tmpdir(), tempName);

  // ── Online backup via better-sqlite3's wrapper around sqlite3_backup_*  ──
  // This is the SQLite-safe way to snapshot a live DB. It works correctly even
  // if other connections are writing during the copy — no risk of a torn file.
  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    await db.backup(tempPath);
  } catch (err) {
    return NextResponse.json(
      { error: `Backup failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  } finally {
    db?.close();
  }

  // Stream the snapshot to the client, then delete the temp file once the
  // stream drains. We don't load the whole file into memory.
  const stat = await fs.stat(tempPath);
  const nodeStream = createReadStream(tempPath);
  nodeStream.on('close', () => {
    void fs.unlink(tempPath).catch(() => undefined);
  });

  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  const downloadName = `finance-${todayStamp()}.db`;

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="${downloadName}"`,
      'X-Backup-Source': dbPath,
      'X-Backup-Auth':   auth.via,
      'Cache-Control': 'no-store',
    },
  });
}
