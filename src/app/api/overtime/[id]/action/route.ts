import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyOvertimeToken } from '@/lib/auth/hmac';
import { sendEmail } from '@/lib/email/sendEmail';
import { overtimeStatusEmailHtml } from '@/lib/email/templates';
import { format } from 'date-fns';

type Params = Promise<{ id: string }>;

function htmlPage(title: string, message: string, color: string): NextResponse {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#030712;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.card{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:40px 48px;text-align:center;max-width:420px;}
h1{color:${color};font-size:22px;margin:0 0 12px;}p{color:#9ca3af;font-size:14px;margin:0;}</style>
</head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? '';
  const token  = searchParams.get('token') ?? '';

  if (!verifyOvertimeToken(id, action, token)) {
    return htmlPage('Invalid Link', 'This link is invalid or has expired.', '#ef4444');
  }

  const ot = await prisma.overtimeRequest.findUnique({
    where: { id },
    include: { contractor: { include: { user: true } } },
  });

  if (!ot) return htmlPage('Not Found', 'This overtime request no longer exists.', '#f59e0b');
  if (ot.status !== 'pending') {
    return htmlPage(
      'Already Actioned',
      `This overtime request has already been ${ot.status}.`,
      '#f59e0b',
    );
  }

  const newStatus = action === 'approve' ? 'approved' : 'denied';
  await prisma.overtimeRequest.update({ where: { id }, data: { status: newStatus } });

  // Notify contractor
  sendEmail({
    to: ot.contractor.user.email,
    subject: `Overtime ${newStatus === 'approved' ? 'Approved' : 'Denied'} — ${format(ot.overtimeDate, 'd MMMM yyyy')}`,
    html: overtimeStatusEmailHtml({
      name: ot.contractor.name,
      overtimeDate: format(ot.overtimeDate, 'EEEE, d MMMM yyyy'),
      hours: ot.hours,
      status: newStatus,
    }),
  }).catch((err) => console.error('Overtime status email failed:', err));

  return newStatus === 'approved'
    ? htmlPage('Overtime Approved ✓', `${ot.contractor.name}'s overtime request (${ot.hours}h on ${format(ot.overtimeDate, 'd MMM yyyy')}) has been approved and will be included in their next payslip.`, '#059669')
    : htmlPage('Overtime Denied ✗', `${ot.contractor.name}'s overtime request has been denied.`, '#ef4444');
}
