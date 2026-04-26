const BRAND_COLOR = '#7c3aed'; // violet-700
const BRAND_LIGHT = '#ede9fe'; // violet-100
const FONT = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;';
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function wrapper(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;${FONT}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr>
          <td style="background:${BRAND_COLOR};padding:24px 32px;">
            <p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:-.3px;">Voice AI Solutions</p>
            <p style="margin:4px 0 0;color:#ddd6fe;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Contractor Portal</p>
          </td>
        </tr>
        <tr><td style="padding:32px;">${body}</td></tr>
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">This email was sent by Voice AI Solutions. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string, bg = BRAND_COLOR, color = '#fff'): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:${bg};color:${color};text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${label}</a>`;
}

// ─── Admin Invite Email ───────────────────────────────────────────────────────

export function adminInviteEmailHtml(opts: { name: string; appUrl: string }): string {
  const loginUrl = `${opts.appUrl}/login`;
  const body = `
    <p style="margin:0 0 8px;color:#374151;font-size:16px;font-weight:600;">Hi ${opts.name},</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">You've been given admin access to the <strong>Voice AI Solutions Finance Dashboard</strong>.</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">To log in, enter your email address and you'll receive a one-time code — no password needed.</p>
    <div style="text-align:center;margin:32px 0;">${btn(loginUrl, 'Access Finance Dashboard')}</div>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center;">Or copy this link: <a href="${loginUrl}" style="color:${BRAND_COLOR};">${loginUrl}</a></p>`;
  return wrapper(body);
}

// ─── OTP Email ────────────────────────────────────────────────────────────────

export function otpEmailHtml(opts: { code: string; name?: string }): string {
  const greeting = opts.name ? `Hi ${opts.name},` : 'Hi there,';
  const body = `
    <p style="margin:0 0 8px;color:#374151;font-size:16px;font-weight:600;">${greeting}</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Your login code for the Voice AI Solutions Contractor Portal is:</p>
    <div style="text-align:center;margin:32px 0;">
      <span style="display:inline-block;background:${BRAND_LIGHT};color:${BRAND_COLOR};font-size:40px;font-weight:800;letter-spacing:12px;padding:16px 32px;border-radius:12px;">${opts.code}</span>
    </div>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center;">This code expires in 10 minutes. Do not share it with anyone.</p>`;
  return wrapper(body);
}

// ─── Invite Email ─────────────────────────────────────────────────────────────

export function inviteEmailHtml(opts: { name: string; appUrl: string }): string {
  const loginUrl = `${opts.appUrl}/login`;
  const body = `
    <p style="margin:0 0 8px;color:#374151;font-size:16px;font-weight:600;">Hi ${opts.name},</p>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">You've been invited to the Voice AI Solutions Contractor Portal.</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">You can access your payslips and submit leave requests here. To log in, simply enter your email address and we'll send you a one-time code — no password needed.</p>
    <div style="text-align:center;margin:32px 0;">${btn(loginUrl, 'Go to Contractor Portal')}</div>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center;">Or copy this link: <a href="${loginUrl}" style="color:${BRAND_COLOR};">${loginUrl}</a></p>`;
  return wrapper(body);
}

// ─── Leave Request Email (to admin) ──────────────────────────────────────────

export function leaveRequestEmailHtml(opts: {
  contractorName: string;
  leaveDate: string;
  reason: string;
  approveUrl: string;
  denyUrl: string;
}): string {
  const body = `
    <p style="margin:0 0 8px;color:#374151;font-size:16px;font-weight:600;">Leave Request</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;"><strong>${opts.contractorName}</strong> has requested a day of leave.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;">
        <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Date</span><br>
        <span style="color:#111827;font-size:14px;font-weight:600;">${opts.leaveDate}</span>
      </td></tr>
      <tr><td style="padding:6px 0;">
        <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Reason</span><br>
        <span style="color:#374151;font-size:14px;">${opts.reason}</span>
      </td></tr>
    </table>
    <div style="text-align:center;">
      ${btn(opts.approveUrl, '✓ Approve', '#059669')}
      &nbsp;&nbsp;
      ${btn(opts.denyUrl, '✗ Deny', '#dc2626')}
    </div>
    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center;">Clicking a button takes immediate effect. You can also manage leave in the Contractor Portal.</p>`;
  return wrapper(body);
}

// ─── Leave Status Email (to contractor) ──────────────────────────────────────

export function leaveStatusEmailHtml(opts: {
  name: string;
  leaveDate: string;
  status: 'approved' | 'denied';
  adminNote?: string;
}): string {
  const isApproved = opts.status === 'approved';
  const statusColor = isApproved ? '#059669' : '#dc2626';
  const statusLabel = isApproved ? 'Approved ✓' : 'Denied ✗';
  const body = `
    <p style="margin:0 0 8px;color:#374151;font-size:16px;font-weight:600;">Hi ${opts.name},</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Your leave request for <strong>${opts.leaveDate}</strong> has been reviewed.</p>
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;background:${isApproved ? '#dcfce7' : '#fee2e2'};color:${statusColor};font-size:20px;font-weight:700;padding:12px 32px;border-radius:8px;">${statusLabel}</span>
    </div>
    ${opts.adminNote ? `<p style="margin:16px 0 0;color:#6b7280;font-size:14px;text-align:center;">Note from admin: <em>${opts.adminNote}</em></p>` : ''}`;
  return wrapper(body);
}

// ─── Payslip Email (to contractor) ───────────────────────────────────────────

export function payslipEmailHtml(opts: {
  name: string;
  month: number;
  year: number;
  workingDays: number;
  leaveDays: number;
  billableDays: number;
  dailyRate: number;
  netAmount: number;
  currency: string;
  appUrl: string;
}): string {
  const monthName = MONTH_NAMES[opts.month];
  const fmt = (n: number) => n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const portalUrl = `${opts.appUrl}/contractor/portal`;
  const body = `
    <p style="margin:0 0 8px;color:#374151;font-size:16px;font-weight:600;">Hi ${opts.name},</p>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Your payslip for <strong>${monthName} ${opts.year}</strong> has been generated.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;">Item</td>
        <td style="padding:10px 16px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;text-align:right;">Amount</td>
      </tr>
      <tr><td style="padding:10px 16px;color:#374151;font-size:14px;">Working Days (${opts.workingDays} × ${opts.currency} ${fmt(opts.dailyRate)})</td><td style="padding:10px 16px;text-align:right;color:#374151;font-size:14px;">${opts.currency} ${fmt(opts.workingDays * opts.dailyRate)}</td></tr>
      <tr style="background:#fef2f2;"><td style="padding:10px 16px;color:#dc2626;font-size:14px;">Leave Deduction (${opts.leaveDays} day${opts.leaveDays !== 1 ? 's' : ''})</td><td style="padding:10px 16px;text-align:right;color:#dc2626;font-size:14px;">− ${opts.currency} ${fmt(opts.leaveDays * opts.dailyRate)}</td></tr>
      <tr style="background:${BRAND_LIGHT};"><td style="padding:12px 16px;color:${BRAND_COLOR};font-size:15px;font-weight:700;">Net Amount</td><td style="padding:12px 16px;text-align:right;color:${BRAND_COLOR};font-size:15px;font-weight:700;">${opts.currency} ${fmt(opts.netAmount)}</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0;">${btn(portalUrl, 'View in Portal')}</div>`;
  return wrapper(body);
}
