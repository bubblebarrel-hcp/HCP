import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy so the browser never holds a JWT. Every authenticated call
// from services/api.ts goes through here; the access and refresh tokens live
// only in the httpOnly cookies this route sets and reads.
const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:5010/api/v1';
const ACCESS_TTL = 15 * 60;                // matches JWT_ACCESS_EXPIRES_IN
const REFRESH_TTL = 30 * 24 * 60 * 60;

// The API being down is an infrastructure failure, not a request failure, and
// has to be told apart from an upstream HTTP error.
class BackendUnreachable extends Error {}

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

async function callBackend(
  path: string, method: string, search: string,
  body: string | undefined, token: string | undefined,
) {
  try {
    return await fetch(`${BACKEND}/${path}${search}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body } : {}),
    });
  } catch (err) {
    throw new BackendUnreachable(err instanceof Error ? err.message : String(err));
  }
}

// Multiple components can 401 on the same expired access token in the same tick
// (e.g. a header and a page both fetching on mount). The backend rotates the
// refresh token on every use, so firing /auth/refresh once per 401 desyncs the
// cookie the browser ends up with from what's stored server-side. Cache the
// in-flight refresh per refresh-token value so concurrent 401s share one
// rotation instead of racing each other.
const inFlightRefresh = new Map<string, Promise<{ accessToken: string; refreshToken: string } | null>>();

function refreshTokens(refresh: string) {
  const existing = inFlightRefresh.get(refresh);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const r = await fetch(`${BACKEND}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!r.ok) return null;
      const refreshed = await r.json() as { data: { accessToken: string; refreshToken: string } };
      return refreshed.data;
    } catch {
      return null;
    }
  })();

  inFlightRefresh.set(refresh, promise);
  promise.finally(() => inFlightRefresh.delete(refresh));
  return promise;
}

async function forwardRequest(req: NextRequest, pathSegments: string[]) {
  const path = pathSegments.join('/');
  const search = req.nextUrl.search;
  const isBodyMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const body = isBodyMethod ? await req.text() : undefined;

  const token = req.cookies.get('hcp_access')?.value;
  let upstream = await callBackend(path, req.method, search, body, token);

  // Access token missing or expired — try a silent refresh once, for any endpoint.
  let refreshedAccess: string | undefined;
  let refreshedRefresh: string | undefined;
  if (upstream.status === 401) {
    const refresh = req.cookies.get('hcp_refresh')?.value;
    if (refresh) {
      const refreshed = await refreshTokens(refresh);
      if (refreshed) {
        refreshedAccess = refreshed.accessToken;
        refreshedRefresh = refreshed.refreshToken;
        upstream = await callBackend(path, req.method, search, body, refreshedAccess);
      }
    }
  }

  const text = await upstream.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* non-JSON upstream response, pass through as text */ }

  // Endpoints that mint fresh tokens (login/register/refresh) return them in the
  // JSON body — lift those into httpOnly cookies and strip them from what
  // reaches the browser instead of ever exposing them to client JS.
  let outBody = text;
  let newAccess = refreshedAccess;
  let newRefresh = refreshedRefresh;
  if (json && typeof json === 'object' && 'data' in json) {
    const data = (json as { data?: Record<string, unknown> }).data;
    if (data && typeof data === 'object' && typeof data.accessToken === 'string') {
      newAccess = data.accessToken;
      if (typeof data.refreshToken === 'string') newRefresh = data.refreshToken;
      const { accessToken: _a, refreshToken: _r, ...rest } = data;
      outBody = JSON.stringify({ ...(json as object), data: rest });
    }
  }

  const res = new NextResponse(outBody, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });

  if (newAccess) res.cookies.set('hcp_access', newAccess, { ...cookieOpts, maxAge: ACCESS_TTL });
  if (newRefresh) res.cookies.set('hcp_refresh', newRefresh, { ...cookieOpts, maxAge: REFRESH_TTL });

  return res;
}

// Without this, an API that is not running throws out of the route handler and
// the browser gets Next's default 500 with an empty body — which parses as
// nothing and tells the user nothing. Answer in the same envelope the API uses.
async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  try {
    return await forwardRequest(req, pathSegments);
  } catch (err) {
    if (!(err instanceof BackendUnreachable)) throw err;
    return NextResponse.json(
      {
        success: false,
        error: { message: `Cannot reach the HCP API at ${BACKEND}. Is it running?`, code: 'BACKEND_UNREACHABLE' },
      },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, (await params).path);
}
