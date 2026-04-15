import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  // DATABASE_URL can be "file:/data/finance.db" (Railway) or "file:./prisma/finance.db" (local)
  // Fall back to the local dev path if not set
  const rawUrl = process.env.DATABASE_URL ?? 'file:./prisma/finance.db';
  const filePath = rawUrl.replace(/^file:/, '');
  const dbPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
