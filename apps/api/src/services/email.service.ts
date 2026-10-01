import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { LANDSCAPE_CID, LANDSCAPE_PNG_BASE64, STICKERS, WORDMARK_CID, WORDMARK_PNG_BASE64 } from './email-assets';
import {
  genericContent,
  plainText,
  renderEmail,
  signupConfirmationContent,
  welcomeContent,
} from './email-templates';

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

const landscape = Buffer.from(LANDSCAPE_PNG_BASE64, 'base64');
const wordmark = Buffer.from(WORDMARK_PNG_BASE64, 'base64');

const inline = (filename: string, content: Buffer, contentId: string) => ({
  filename,
  content,
  contentType: 'image/png',
  contentId,
});

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  action?: { label: string; path: string };
  template?: 'signup-confirmation' | 'welcome';
  // Public name to greet: the hash handle or "Just <firstName>" (D11), never biodata.
  name?: string;
}): Promise<EmailResult> {
  if (!resend) return { sent: false, error: 'Email provider not configured' };

  const action = input.action ? { label: input.action.label, url: `${env.appBaseUrl}${input.action.path}` } : undefined;
  const name = input.name ?? 'there';

  const content =
    input.template === 'signup-confirmation' && action
      ? signupConfirmationContent(name, action)
      : input.template === 'welcome' && action
        ? welcomeContent(name, action)
        : genericContent(input.subject, input.body, action);

  // A different trail mark each time, so the mail is never quite the same twice.
  const sticker = STICKERS[Math.floor(Math.random() * STICKERS.length)];

  try {
    const result = await resend.emails.send({
      from: env.email.from,
      to: input.to,
      subject: input.subject,
      html: renderEmail(content, LANDSCAPE_CID, sticker),
      text: plainText(content),
      attachments: [
        inline('landscape.png', landscape, LANDSCAPE_CID),
        inline('wordmark.png', wordmark, WORDMARK_CID),
        inline(`${sticker.cid}.png`, Buffer.from(sticker.base64, 'base64'), sticker.cid),
      ],
      ...(env.email.replyTo ? { replyTo: env.email.replyTo } : {}),
    });
    if (result.error) return { sent: false, error: result.error.message };
    return { sent: true, providerMessageId: result.data?.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}
