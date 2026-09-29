import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

// The API asks this route to drop a cached public page.
//
// Public pages are Server Components with `revalidate = 60`. That window
// refreshes a page whose data changed, but not one whose data disappeared: when
// the backend starts answering 404 the regeneration calls `notFound()`, Next
// throws that render away and keeps serving the last successful one. An
// archived kennel would otherwise stay readable at its old URL indefinitely.
//
// This is the one route in the app that acts on an unauthenticated request from
// outside, so it is deliberately narrow: a shared secret, a compare that does
// not leak its answer through timing, a capped list, and only app-relative
// paths.

const MAX_PATHS = 20;

function secretMatches(given: string | null, expected: string) {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself be a tell.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  // No secret configured means no way to authenticate the caller, so refuse
  // rather than accept anonymous cache eviction.
  if (!expected) {
    return NextResponse.json(
      { success: false, error: { message: 'Revalidation is not configured.', code: 'NOT_CONFIGURED' } },
      { status: 503 },
    );
  }

  if (!secretMatches(req.headers.get('x-hcp-revalidate-secret'), expected)) {
    return NextResponse.json(
      { success: false, error: { message: 'Not allowed.', code: 'FORBIDDEN' } },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { message: 'Expected a JSON body.', code: 'BAD_REQUEST' } },
      { status: 400 },
    );
  }

  const raw = (body as { paths?: unknown })?.paths;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: 'Expected { paths: string[] }.', code: 'BAD_REQUEST' } },
      { status: 400 },
    );
  }

  // Only in-app paths: one leading slash, no scheme, no protocol-relative "//"
  // that would read as another origin.
  const paths = raw
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim())
    .filter((p) => p.startsWith('/') && !p.startsWith('//') && !p.includes('://'))
    .slice(0, MAX_PATHS);

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ success: true, data: { revalidated: paths } });
}
