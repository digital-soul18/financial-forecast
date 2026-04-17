import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, hashJti } from '@/lib/auth/jwt';
import { revokeSession, COOKIE_NAME } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      const payload = await verifyJWT(token);
      if (payload?.jti) {
        await revokeSession(hashJti(payload.jti)).catch(() => {}); // Ignore if already gone
      }
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return res;
  } catch (err) {
    console.error('logout error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
