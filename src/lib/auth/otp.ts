import { randomInt } from 'crypto';
import { prisma } from '@/lib/db';

const OTP_EXPIRY_MINUTES = 10;

/** Generate a random 6-digit OTP code (zero-padded). */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Invalidate any existing unused OTPs for this user, then create a new one.
 * Returns the plain-text code (to be emailed).
 */
export async function createOtpRecord(userId: string): Promise<string> {
  // Invalidate previous unused OTPs
  await prisma.otpToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpToken.create({
    data: { userId, code, expiresAt },
  });

  return code;
}

/**
 * Validate an OTP code. Returns true if valid; marks it as used.
 * Returns false if not found, already used, or expired.
 */
export async function validateOtp(userId: string, code: string): Promise<boolean> {
  const otp = await prisma.otpToken.findFirst({
    where: {
      userId,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) return false;

  await prisma.otpToken.update({
    where: { id: otp.id },
    data: { used: true },
  });

  return true;
}
