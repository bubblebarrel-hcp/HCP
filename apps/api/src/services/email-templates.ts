import { env } from '../config/env';
import { WORDMARK_CID, WORDMARK_HEIGHT, WORDMARK_WIDTH, type Sticker } from './email-assets';

// One shell for every Shiggy Trails email: wordmark, a tinted panel holding a white card,
// a sign-off strip, the landscape, three links on an orange base, small print.
// Tables and inline styles only: mail clients ignore everything else.
//
// Palette is the D24 brand system. Orange is a fill here, never small text, so
// the button and footer carry Hash Black type.

export const BRAND = 'Shiggy Trails';

const C = {
  orange: '#f4511e',
  ember: '#b83a0e',
  black: '#171717',
  flour: '#f4f1e8',
  panel: '#fce4da', // orange tint behind the card
  strip: '#fdf3ec', // sign-off strip, same family as the sky in the landscape
  body: '#53534d',
  muted: '#85857b',
};

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface EmailContent {
  preheader: string;
  greeting: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  note?: string;
  signOff: string[];
  // Why this person is getting the mail, shown in the small print.
  reason: string;
}

function paragraphs(items: string[]) {
  return items
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${C.body}">${escapeHtml(p)}</p>`)
    .join('');
}

function footerLink(glyph: string, label: string, linkText: string, url: string) {
  return `<td width="33%" align="center" valign="top" style="padding:0 6px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" width="34" height="34" bgcolor="${C.black}" style="border-radius:17px;color:${C.flour};font-size:16px;line-height:34px;font-weight:700">${glyph}</td></tr></table>
    <div style="margin-top:9px;font-size:13px;line-height:1.4;color:${C.black}">${escapeHtml(label)}<br><a href="${escapeHtml(url)}" style="color:${C.black};font-weight:700;text-decoration:underline">${escapeHtml(linkText)}</a></div>
  </td>`;
}

export function renderEmail(content: EmailContent, landscapeCid: string, sticker: Sticker) {
  const base = env.appBaseUrl;
  const contact = env.email.replyTo ? `mailto:${env.email.replyTo}` : base;
  const year = new Date().getFullYear();

  const button = content.action
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 22px"><tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${C.orange}" style="border-radius:10px">
          <a href="${escapeHtml(content.action.url)}" style="display:inline-block;min-width:260px;padding:16px 28px;color:${C.black};font-size:18px;font-weight:700;text-decoration:none;text-align:center;border-radius:10px">${escapeHtml(content.action.label)}</a>
        </td></tr></table>
      </td></tr></table>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><title>${escapeHtml(BRAND)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:${C.black}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#ffffff">${escapeHtml(content.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
    <tr><td align="center" style="padding:28px 12px 32px">

      <div style="padding-bottom:22px"><img src="cid:${WORDMARK_CID}" width="${WORDMARK_WIDTH}" height="${WORDMARK_HEIGHT}" alt="${escapeHtml(BRAND)}" style="display:block;margin:0 auto;border:0;font-size:26px;font-weight:800;letter-spacing:2px;color:${C.black}"></div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
        <tr><td bgcolor="${C.panel}" style="background:${C.panel};padding:20px 20px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
            <tr><td align="center" style="padding:30px 34px 6px">
              <img src="cid:${sticker.cid}" width="${sticker.width}" height="${sticker.height}" alt="${escapeHtml(sticker.alt)}" style="display:block;margin:0 auto 18px;border:0">
              <h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;font-weight:700;color:${C.black}">${escapeHtml(content.greeting)}</h1>
              ${paragraphs(content.paragraphs)}
              ${button}
              ${content.note ? `<p style="margin:0 0 30px;font-size:15px;line-height:1.55;color:${C.body}">${escapeHtml(content.note)}</p>` : '<div style="height:16px;font-size:0;line-height:0">&nbsp;</div>'}
            </td></tr>
            <tr><td align="center" bgcolor="${C.strip}" style="background:${C.strip};padding:26px 34px 28px;font-size:16px;line-height:1.55;color:${C.black}">
              ${content.signOff.map(escapeHtml).join('<br>')}
            </td></tr>
          </table>
        </td></tr>
        <tr><td bgcolor="${C.panel}" style="background:${C.panel};font-size:0;line-height:0"><img src="cid:${landscapeCid}" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;border:0"></td></tr>
        <tr><td bgcolor="${C.orange}" style="background:${C.orange};padding:6px 14px 34px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            ${footerLink('&#9873;', 'Find your', 'Kennel', `${base}/kennels`)}
            ${footerLink('&#9733;', 'See the', 'Next run', `${base}/runs`)}
            ${footerLink('?', 'Questions?', 'We’re here', contact)}
          </tr></table>
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
        <tr><td align="center" style="padding:22px 24px 0;font-size:13px;line-height:1.6;color:${C.muted}">${escapeHtml(content.reason)}</td></tr>
        <tr><td align="center" style="padding:14px 24px 0;font-size:12px;line-height:1.6;color:${C.muted}">&copy; ${year} ${escapeHtml(BRAND)}. Every Run. Every Trail. Every Story.</td></tr>
      </table>

    </td></tr>
  </table>
</body></html>`;
}

export function plainText(content: EmailContent) {
  return [
    content.greeting,
    '',
    ...content.paragraphs.flatMap((p) => [p, '']),
    ...(content.action ? [`${content.action.label}: ${content.action.url}`, ''] : []),
    ...(content.note ? [content.note, ''] : []),
    ...content.signOff,
    '',
    content.reason,
  ].join('\n');
}

// ── The mails themselves ─────────────────────────────────────────────────────

export function signupConfirmationContent(name: string, action: { label: string; url: string }): EmailContent {
  return {
    preheader: `Confirm your email to start using ${BRAND}.`,
    greeting: `Hi ${name},`,
    paragraphs: [
      `Please confirm that this is the email address you used to sign up for ${BRAND}, so we can find your kennel, your runs and your stories a home.`,
    ],
    action,
    note: 'This link is valid for 24 hours. Your email address stays private: other hashers only ever see your hash name.',
    signOff: ['On On!', `The ${BRAND} Team`],
    reason: `If you did not sign up for ${BRAND} with this email address, you can safely ignore this message.`,
  };
}

export function welcomeContent(name: string, action: { label: string; url: string }): EmailContent {
  return {
    preheader: `You're in. Find your kennel and your first run.`,
    greeting: `Welcome to the pack, ${name}!`,
    paragraphs: [
      'Your email is confirmed and your account is ready.',
      'Find your kennel, see which runs are coming up, and start building your Hash Passport. Every run you join adds a stamp.',
    ],
    action,
    note: 'Until a kennel gives you a hash name you appear to others as “Just” and your first name. Earn one on trail.',
    signOff: ['On On!', `The ${BRAND} Team`],
    reason: `You are receiving this because you just confirmed your ${BRAND} account.`,
  };
}

export function genericContent(title: string, body: string, action?: { label: string; url: string }): EmailContent {
  return {
    preheader: body.slice(0, 110),
    greeting: title,
    paragraphs: [body],
    action,
    signOff: ['On On!', `The ${BRAND} Team`],
    reason: `You are receiving this because of your ${BRAND} account or a run you registered for.`,
  };
}
