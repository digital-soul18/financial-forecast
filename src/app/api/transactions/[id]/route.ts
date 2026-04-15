import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if ('category' in body) {
    updates.category = body.category;
    updates.categorySource = 'manual';
  }
  if ('subcategory' in body) updates.subcategory = body.subcategory;
  if ('rdEligible' in body) updates.rdEligible = body.rdEligible;
  if ('rdPercentage' in body) updates.rdPercentage = body.rdPercentage;
  if ('notes' in body) updates.notes = body.notes;

  const tx = await prisma.transaction.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({
    ...tx,
    date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
  });
}
