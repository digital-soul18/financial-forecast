import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyLeaveToken } from '@/lib/auth/hmac';
import { sendEmail } from '@/lib/email/sendEmail';
import { leaveStatusEmailHtml } from '@/lib/email/templates';
import { format } from 'date-fns';

type Params = Promise<{ id: string }>;

function htmlPage(title: string, message: string, color: string): NextResponse {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#fff;border-radius:12px;padding:40px;max-width:420px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="width:64px;height:64px;border-radius:50%;background:${color}22;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;">
      <span style="font-size:32px;">${color === '#059669' ? '✓' : color === '#dc2626' ? '✗' : 'ℹ'}</span>
    </div>
    <h1 style="margin:0 0 12px;color:#111827;font-size:22px;">${title}</h1>
    <p style="margin:0;color:#6b7280;font-size:15px;">${message}</p>
  </div>
</body>
</html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// GET — public endpoint, HMAC-verified; no cookie required
// Called from email approve/deny buttons
export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? '';
  const token = searchParams.get('token') ?? '';

  // Verify HMAC token
  if (!verifyLeaveToken(id, action, token)) {
    return htmlPage('Invalid Link', 'This link is invalid or has expired.', '#dc2626');
  }

  try {
    const lr = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { contractor: { include: { user: true } } },
    });

    if (!lr) {
      return htmlPage('Not Found', 'This leave request no longer exists.', '#6b7280');
    }

    if (lr.status !== 'pending') {
      const alreadyLabel = lr.status === 'approved' ? 'approved' : 'denied';
      return htmlPage(
        'Already Processed',
        `This leave request has already been ${alreadyLabel}.`,
        '#6b7280',
      );
    }

    const newStatus = action as 'approve' | 'deny';
    const updatedLr = await prisma.leaveRequest.update({
      where: { id },
      data: { status: newStatus === 'approve' ? 'approved' : 'denied' },
    });

    // Notify contractor
    const leaveDateFormatted = format(lr.leaveDate, 'EEEE, d MMMM yyyy');
    const finalStatus = updatedLr.status as 'approved' | 'denied';
    sendEmail({
      to: lr.contractor.user.email,
      subject: `Leave request ${finalStatus} — ${leaveDateFormatted}`,
      html: leaveStatusEmailHtml({
        name: lr.contractor.name,
        leaveDate: leaveDateFormatted,
        status: finalStatus,
      }),
    }).catch((err) => console.error('Leave status email failed:', err));

    const isApproved = finalStatus === 'approved';
    return htmlPage(
      isApproved ? 'Leave Approved ✓' : 'Leave Denied ✗',
      `${lr.contractor.name}'s leave request for ${leaveDateFormatted} has been ${finalStatus}. You can close this window.`,
      isApproved ? '#059669' : '#dc2626',
    );
  } catch (err) {
    console.error('GET /api/leave/[id]/action error:', err);
    return htmlPage('Error', 'Something went wrong. Please try again or log in to manage leave.', '#dc2626');
  }
}
