import { createHmac, timingSafeEqual } from 'crypto';

function hmacHex(message: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET not set');
  return createHmac('sha256', secret).update(message).digest('hex');
}

function verify(token: string, expected: string): boolean {
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(token, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Leave tokens ──────────────────────────────────────────────────────────────

export function signLeaveToken(leaveId: string, action: 'approve' | 'deny'): string {
  return hmacHex(`leave:${leaveId}:${action}`);
}

export function verifyLeaveToken(leaveId: string, action: string, token: string): boolean {
  if (action !== 'approve' && action !== 'deny') return false;
  return verify(token, signLeaveToken(leaveId, action as 'approve' | 'deny'));
}

// ── Overtime tokens ───────────────────────────────────────────────────────────

export function signOvertimeToken(overtimeId: string, action: 'approve' | 'deny'): string {
  return hmacHex(`overtime:${overtimeId}:${action}`);
}

export function verifyOvertimeToken(overtimeId: string, action: string, token: string): boolean {
  if (action !== 'approve' && action !== 'deny') return false;
  return verify(token, signOvertimeToken(overtimeId, action as 'approve' | 'deny'));
}
