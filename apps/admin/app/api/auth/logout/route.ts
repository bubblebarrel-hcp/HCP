import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_API_URL ?? 'http://localhost:5010/api/v1';

// Revokes the refresh token upstream, then clears both cookies regardless of
// what upstream said. Logging out locally must always succeed.
export async function POST(req: NextRequest) {
  const refresh = req.cookies.get('hcp_admin_refresh')?.value;
  if (refresh) {
    try {
      await fetch(`${BACKEND}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch {
      /* backend down: the cookies still go */
    }
  }

  const res = NextResponse.json({ success: true, data: { loggedOut: true } });
  res.cookies.set('hcp_admin_access', '', { path: '/', maxAge: 0 });
  res.cookies.set('hcp_admin_refresh', '', { path: '/', maxAge: 0 });
  return res;
}
