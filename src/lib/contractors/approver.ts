import { prisma } from '@/lib/db';

/**
 * Get the configured approver email for leave / overtime notifications.
 * Priority: AppSetting "approver_email" → first active admin → ADMIN_EMAIL env.
 */
export async function getApproverEmail(): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'approver_email' } });
  if (setting?.value) return setting.value;

  const admin = await prisma.user.findFirst({ where: { role: 'admin', isActive: true } });
  return admin?.email ?? process.env.ADMIN_EMAIL ?? null;
}

/**
 * Get the configured approver display name (used in emails).
 */
export async function getApproverName(): Promise<string> {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'approver_name' } });
  return setting?.value ?? 'your manager';
}
