import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';
import { createId } from '@paralleldrive/cuid2';

export interface JWTPayload {
  sub: string;       // userId
  email: string;
  role: 'admin' | 'contractor';
  jti: string;       // unique token ID
  iat: number;
  exp: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET environment variable is not set');
  return new TextEncoder().encode(secret);
}

/**
 * Sign a JWT with HS256. Returns the token string.
 * expiresIn examples: '7d', '24h', '10m'
 */
export async function signJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>,
  expiresIn: string,
): Promise<{ token: string; jti: string }> {
  const jti = createId();
  const token = await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
  return { token, jti };
}

/**
 * Verify a JWT. Returns the payload or null on any error (expired, invalid, etc).
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Hash a JTI for storage in UserSession.tokenHash.
 * SHA256(jti) stored instead of raw jti — enables revocation without exposing the JWT.
 */
export function hashJti(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}
