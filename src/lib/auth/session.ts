import { NextRequest, NextResponse } from 'next/server';
import { signJWT, verifyJWT, hashJti, JWTPayload } from './jwt';
import { prisma } from '@/lib/db';

const COOKIE_NAME = '__auth_token';

/**
 * Create a session: signs JWT, stores tokenHash in DB, sets httpOnly cookie on the response.
 */
export async function createSession(
  opts: { userId: string; email: string; role: 'admin' | 'contractor' },
  res: NextResponse,
): Promise<void> {
  const expiresIn = opts.role === 'admin' ? '7d' : '24h';
  const maxAgeSec = opts.role === 'admin' ? 60 * 60 * 24 * 7 : 60 * 60 * 24;

  const { token, jti } = await signJWT(
    { sub: opts.userId, email: opts.email, role: opts.role },
    expiresIn,
  );

  const tokenHash = hashJti(jti);
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000);

  await prisma.userSession.create({
    data: { userId: opts.userId, tokenHash, expiresAt },
  });

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSec,
  });
}

/**
 * Revoke a session by deleting it from the DB. Pass the tokenHash from the JWT.
 */
export async function revokeSession(tokenHash: string): Promise<void> {
  await prisma.userSession.deleteMany({ where: { tokenHash } });
}

/**
 * Read and verify the session cookie from a request. Returns the JWT payload or null.
 */
export async function getSessionFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyJWT(token);
}

export { COOKIE_NAME };
