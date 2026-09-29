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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  action?: { label: string; path: string };
}): Promise<EmailResult> {
  if (!resend) return { sent: false, error: 'Email provider not configured' };

  const action = input.action ? { label: input.action.label, url: `${env.appBaseUrl}${input.action.path}` } : undefined;
  try {
    const result = await resend.emails.send({
      from: env.email.from,
      to: input.to,
      subject: input.subject,
      html: layout(input.subject, input.body, action),
      text: `${input.subject}\n\n${input.body}${action ? `\n\n${action.label}: ${action.url}` : ''}`,
      ...(env.email.replyTo ? { replyTo: env.email.replyTo } : {}),
    });
    if (result.error) return { sent: false, error: result.error.message };
    return { sent: true, providerMessageId: result.data?.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
