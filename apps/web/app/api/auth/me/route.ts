import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:5010/api/v1';
const ACCESS_TTL = 15 * 60;
const REFRESH_TTL = 30 * 24 * 60 * 60;

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// "Who am I" for AuthContext. Always a 200: `user: null` when logged out, so a
// logged-out first paint doesn't log an error. The access cookie expires with
// its 15-minute token, so a hard refresh after that falls back to the refresh
// cookie instead of reading as a logout.
export async function GET(req: NextRequest) {
  const access = req.cookies.get('hcp_access')?.value;

  if (access) {
    const r = await fetch(`${BACKEND}/auth/me`, {
      headers: { Authorization: `Bearer ${access}` },
      cache: 'no-store',
    });
    if (r.ok) {
      const json = await r.json() as { data: { user: unknown } };
      return NextResponse.json({ success: true, data: { user: json.data.user } });
    }
  }

  const refresh = req.cookies.get('hcp_refresh')?.value;
  if (refresh) {
    const r = await fetch(`${BACKEND}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: 'no-store',
    });
    if (r.ok) {
      const json = await r.json() as { data: { user: unknown; accessToken: string; refreshToken: string } };
      const res = NextResponse.json({ success: true, data: { user: json.data.user } });
      res.cookies.set('hcp_access', json.data.accessToken, { ...cookieOpts, maxAge: ACCESS_TTL });
      res.cookies.set('hcp_refresh', json.data.refreshToken, { ...cookieOpts, maxAge: REFRESH_TTL });
      return res;
    }
  }

  return NextResponse.json({ success: true, data: { user: null } });
}
