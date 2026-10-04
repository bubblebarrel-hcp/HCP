import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import prisma from '../config/prisma';
import { logger } from '../utils/logger';

// What a pasted link looks like (D60).
//
// The server fetches a URL a stranger typed, which is the textbook way to get a
// server to knock on its own internal doors. So every connection this makes is
// to a public address and nothing else: the check happens in the socket's own
// DNS lookup, so the address that was checked is the address that is connected
// to (a name that resolves one way for the check and another for the connection
// gets nothing), and every redirect is checked again. It reads at most 512 KB,
// waits at most five seconds, and only for HTML.

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = 'ShiggyTrailsLinkPreview/1.0 (+https://shiggytrails.example)';

// ─── Which addresses are public ───

function ipv4Private(a: number, b: number) {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, and the cloud metadata address
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

export function isPublicAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return !ipv4Private(a, b);
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return false;
    // IPv4 inside IPv6 (::ffff:10.0.0.1): judge the IPv4.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPublicAddress(mapped[1]);
    if (/^f[cd]/.test(lower)) return false; // unique local
    if (/^fe[89ab]/.test(lower)) return false; // link-local
    if (lower.startsWith('ff')) return false; // multicast
    return true;
  }
  return false;
}

// Passed to the request as its DNS lookup, so connecting uses what was vetted.
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 4);
    const list = Array.isArray(addresses) ? addresses : [];
    const usable = list.filter((a) => isPublicAddress(a.address));
    // One private answer poisons the name: a host that lists an internal address
    // beside a public one is not a host to talk to.
    if (usable.length === 0 || usable.length !== list.length) {
      return callback(new Error('Address not allowed'), '', 4);
    }
    // `all: true` is how it was asked, so `all: true` is how it is answered when
    // the caller wants the list.
    if ((options as { all?: boolean }).all) {
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, usable);
    }
    return callback(null, usable[0].address, usable[0].family);
  });
};

// ─── Fetching ───

function fetchHtml(rawUrl: string, redirects = 0): Promise<{ html: string; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return reject(new Error('Bad URL'));
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return reject(new Error('Not http'));
    if (url.username || url.password) return reject(new Error('Credentials in URL'));
    // A literal address skips DNS, so it is judged here.
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && !isPublicAddress(url.hostname.replace(/^\[|\]$/g, ''))) {
      return reject(new Error('Address not allowed'));
    }
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      {
        method: 'GET',
        lookup: guardedLookup,
        timeout: TIMEOUT_MS,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml', 'accept-language': 'en' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects >= MAX_REDIRECTS) return reject(new Error('Too many redirects'));
          const next = new URL(res.headers.location, url).toString();
          return fetchHtml(next, redirects + 1).then(resolve, reject);
        }
        const type = String(res.headers['content-type'] ?? '');
        if (status !== 200 || !/text\/html|application\/xhtml/i.test(type)) {
          res.resume();
          return reject(new Error(`Not a page (${status} ${type})`));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            // Enough of the page: the tags are in the head.
            chunks.push(chunk.subarray(0, chunk.length - (size - MAX_BYTES)));
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        const done = () => resolve({ html: Buffer.concat(chunks).toString('utf8'), finalUrl: url.toString() });
        res.on('end', done);
        res.on('close', done);
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', reject);
    req.end();
  });
}

// ─── Reading the tags ───

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };

function decode(text: string) {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
      if (name[0] === '#') {
        const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : whole;
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html: string, keys: string[]) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (!key || !keys.includes(key)) continue;
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value) return decode(value);
  }
  return null;
}

export interface ParsedPreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
}

export function parsePreview(html: string, pageUrl: string): ParsedPreview {
  const head = html.slice(0, MAX_BYTES);
  const title =
    metaContent(head, ['og:title', 'twitter:title']) ??
    (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ? decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)![1]) : null);
  const description = metaContent(head, ['og:description', 'twitter:description', 'description']);
  const siteName = metaContent(head, ['og:site_name']) ?? new URL(pageUrl).hostname.replace(/^www\./, '');

  let imageUrl: string | null = null;
  const image = metaContent(head, ['og:image', 'og:image:url', 'twitter:image']);
  if (image) {
    try {
      const resolved = new URL(image, pageUrl);
      if (resolved.protocol === 'https:' || resolved.protocol === 'http:') imageUrl = resolved.toString();
    } catch {
      imageUrl = null;
    }
  }
  const clip = (value: string | null, max: number) => (value && value.length > max ? `${value.slice(0, max - 1)}…` : value);
  return {
    title: clip(title, 200),
    description: clip(description, 300),
    imageUrl: clip(imageUrl, 1000),
    siteName: clip(siteName, 100),
  };
}

// ─── Finding the link ───

// The first web address in the words, without the punctuation a sentence puts
// after it.
export function firstUrl(text: string | null | undefined): string | null {
  const match = /https?:\/\/[^\s<>"]+/i.exec(text ?? '');
  if (!match) return null;
  const cleaned = match[0].replace(/[.,;:!?)\]'"]+$/, '');
  try {
    const url = new URL(cleaned);
    url.hash = '';
    return url.toString().slice(0, 1000);
  } catch {
    return null;
  }
}

export const previewSelect = { url: true, title: true, description: true, imageUrl: true, siteName: true } as const;

// Make sure a preview exists for this URL and return its id, or null when the
// page cannot be read. Never throws: a link that will not load is just a link.
async function previewIdFor(url: string): Promise<string | null> {
  const existing = await prisma.linkPreview.findUnique({ where: { url } });
  if (existing) {
    const age = Date.now() - existing.fetchedAt.getTime();
    if (existing.failedAt) {
      if (age < RETRY_FAILED_MS) return null;
    } else if (age < FRESH_MS) {
      return existing.id;
    }
  }
  try {
    const { html, finalUrl } = await fetchHtml(url);
    const parsed = parsePreview(html, finalUrl);
    if (!parsed.title && !parsed.description && !parsed.imageUrl) throw new Error('Nothing to show');
    const row = await prisma.linkPreview.upsert({
      where: { url },
      create: { url, ...parsed },
      update: { ...parsed, fetchedAt: new Date(), failedAt: null },
    });
    return row.id;
  } catch (error) {
    logger.info(`Link preview failed for ${url}: ${(error as Error).message}`);
    await prisma.linkPreview.upsert({
      where: { url },
      create: { url, failedAt: new Date() },
      update: { failedAt: new Date(), fetchedAt: new Date() },
    });
    return null;
  }
}

// Called after a post is published or its words change. Not awaited by the
// request: the post is up at once and the card appears when the page has been
// read, on the next time anybody opens it.
export function attachPreview(postId: string, body: string) {
  const url = firstUrl(body);
  void (async () => {
    try {
      const linkPreviewId = url ? await previewIdFor(url) : null;
      await prisma.post.update({ where: { id: postId }, data: { linkPreviewId } });
    } catch (error) {
      logger.warn(`Could not attach a link preview to post ${postId}: ${(error as Error).message}`);
    }
  })();
}
