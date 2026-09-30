import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Email delivery through Resend. Without an API key nothing is sent and the
// caller is told so, rather than queueing mail that can never leave.

const resend = env.email.configured ? new Resend(env.email.apiKey) : null;

if (!resend) {
  logger.warn?.('Resend is not configured: notifications stay in-app only (CODEX/PROVIDERS.md)');
}

export function isEmailConfigured() {
  return Boolean(resend);
}

export interface EmailResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
}

function layout(title: string, body: string, action?: { label: string; url: string }) {
  // Deliberately plain: one column, system fonts, HCP Orange on the action.
  return `<!doctype html>
<html><body style="margin:0;background:#f4f1e8;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#171717">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#b83a0e;font-weight:700">Hash Community Platform</p>
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escapeHtml(body)}</p>
    ${
      action
        ? `<a href="${action.url}" style="display:inline-block;background:#f4511e;color:#171717;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:8px">${escapeHtml(action.label)}</a>`
        : ''
    }
  </div>
  <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#6b6b63">
    You are receiving this because of your HCP account or a run you registered for.
  </p>
</body></html>`;
}

function signupConfirmationLayout(action: { label: string; url: string }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Confirm your email | Shiggy Trails</title></head>
<body style="margin:0;padding:0;background:#f4f1e8;font-family:Arial,Helvetica,sans-serif;color:#171717">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1e8">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td align="center" style="background:#171717;padding:42px 32px 38px">
          <div style="font-size:20px;font-weight:800;letter-spacing:1px;color:#ffffff">SHIGGY TRAILS</div>
          <div style="margin-top:7px;font-size:11px;letter-spacing:1px;color:#d8d2c3;text-transform:uppercase">Every Run. Every Trail. Every Story.</div>
          <div style="margin-top:30px;font-size:42px;line-height:1">&#128095;</div>
          <h1 style="margin:20px 0 10px;font-size:34px;line-height:1.15;color:#ffffff">You're nearly in.</h1>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#e5e1d7">One quick confirmation, then the trail is yours.</p>
        </td></tr>
        <tr><td style="height:5px;background:#f4511e;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:36px 32px">
          <h2 style="margin:0 0 14px;font-size:23px;line-height:1.3;color:#171717">The trail starts here.</h2>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#53534d">Thanks for joining Shiggy Trails, a home for the kennels, runs, and stories that make Hashing what it is.</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#53534d">Confirm your email to find your kennel, discover upcoming runs, follow trails, and keep the best moments alive long after the mud has dried.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:17px 18px;background:#f4f1e8;border-radius:8px">
              <div style="font-size:12px;font-weight:800;letter-spacing:.5px;color:#171717;text-transform:uppercase">Find your pack</div>
              <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#53534d">Connect with kennels and the people who make every run memorable.</div>
            </td></tr>
            <tr><td height="10" style="font-size:0;line-height:0">&nbsp;</td></tr>
            <tr><td style="padding:17px 18px;background:#f4f1e8;border-radius:8px">
              <div style="font-size:12px;font-weight:800;letter-spacing:.5px;color:#171717;text-transform:uppercase">Follow the trail</div>
              <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#53534d">Explore runs, trails, checkpoints, beer stops, and everything in between.</div>
            </td></tr>
            <tr><td height="10" style="font-size:0;line-height:0">&nbsp;</td></tr>
            <tr><td style="padding:17px 18px;background:#f4f1e8;border-radius:8px">
              <div style="font-size:12px;font-weight:800;letter-spacing:.5px;color:#171717;text-transform:uppercase">Tell the story</div>
              <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#53534d">Save the photos, characters, and tales that make each run yours.</div>
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px">
            <tr><td align="center" bgcolor="#f4511e" style="border-radius:8px">
              <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:15px 24px;color:#171717;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px">${escapeHtml(action.label)} &rarr;</a>
            </td></tr>
          </table>
          <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#68685f">This link is valid for 24 hours. If you didn't create a Shiggy Trails account, you can ignore this email.</p>
          <div style="height:1px;background:#e8e5dc;margin:30px 0 18px;font-size:0;line-height:0">&nbsp;</div>
          <p style="margin:0;font-size:14px;line-height:1.7;font-weight:700;color:#171717">Leave no trail unexplored. And absolutely no beer stop undocumented.</p>
        </td></tr>
        <tr><td align="center" style="background:#f8f7f3;padding:22px 24px">
          <div style="font-size:12px;line-height:1.6;color:#68685f">&copy; ${year} Shiggy Trails</div>
          <div style="margin-top:5px;font-size:11px;color:#85857b">Every Run. Every Trail. Every Story.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  action?: { label: string; path: string };
  template?: 'signup-confirmation';
}): Promise<EmailResult> {
  if (!resend) return { sent: false, error: 'Email provider not configured' };

  const action = input.action ? { label: input.action.label, url: `${env.appBaseUrl}${input.action.path}` } : undefined;
  try {
    const result = await resend.emails.send({
      from: env.email.from,
      to: input.to,
      subject: input.subject,
      html: input.template === 'signup-confirmation' && action
        ? signupConfirmationLayout(action)
        : layout(input.subject, input.body, action),
      text: `${input.subject}\n\n${input.body}${action ? `\n\n${action.label}: ${action.url}` : ''}`,
      ...(env.email.replyTo ? { replyTo: env.email.replyTo } : {}),
    });
    if (result.error) return { sent: false, error: result.error.message };
    return { sent: true, providerMessageId: result.data?.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
