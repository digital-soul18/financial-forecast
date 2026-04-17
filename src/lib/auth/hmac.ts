import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Sign a leave action token.
 * Returns HMAC-SHA256(AUTH_SECRET, "${leaveId}:${action}") as hex.
 */
export function signLeaveToken(leaveId: string, action: 'approve' | 'deny'): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET not set');
  return createHmac('sha256', secret)
    .update(`${leaveId}:${action}`)
    .digest('hex');
}

/**
 * Verify a leave action token. Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyLeaveToken(
  leaveId: string,
  action: string,
  token: string,
): boolean {
  if (action !== 'approve' && action !== 'deny') return false;
  try {
    const expected = signLeaveToken(leaveId, action as 'approve' | 'deny');
    const expectedBuf = Buffer.from(expected, 'hex');
    const tokenBuf = Buffer.from(token, 'hex');
    if (expectedBuf.length !== tokenBuf.length) return false;
    return timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    return false;
  }
}
