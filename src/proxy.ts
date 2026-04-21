import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

interface JWTPayload {
  sub: string;
  email: string;
  role: 'admin' | 'contractor';
  jti: string;
}

const COOKIE_NAME = '__auth_token';

// Paths that never need authentication
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
  '/api/auth/logout',
];

// Pattern for HMAC-protected leave action links (no cookie needed)
const LEAVE_ACTION_RE = /^\/api\/leave\/[^/]+\/action$/;

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Always allow static assets
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    /\.\w{2,5}$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Always allow public paths
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Allow HMAC-protected leave action endpoint (no session needed)
  if (LEAVE_ACTION_RE.test(pathname)) {
    return NextResponse.next();
  }

  // Read and verify JWT from cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    console.error('AUTH_SECRET is not configured');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let payload: JWTPayload;
  try {
    const { payload: p } = await jwtVerify(token, new TextEncoder().encode(secret));
    payload = p as unknown as JWTPayload;
  } catch {
    // Expired or invalid token — clear cookie and redirect
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return res;
  }

  // Role-based routing
  // Note: check for '/contractor/' (with trailing slash) so '/contractors' (admin page) is NOT caught
  const isContractorPortalPath = pathname === '/contractor' || pathname.startsWith('/contractor/');
  if (payload.role === 'contractor' && !isContractorPortalPath) {
    return NextResponse.redirect(new URL('/contractor/portal', request.url));
  }
  if (payload.role === 'admin' && isContractorPortalPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Forward user identity to route handlers via headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.sub);
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-user-email', payload.email ?? '');

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
