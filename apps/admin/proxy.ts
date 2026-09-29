import { NextRequest, NextResponse } from 'next/server';

// Edge middleware (Next 16 convention: proxy.ts, default export). Not related
// to app/api/proxy, which is the BFF that holds the tokens.
//
// A cheap presence check only: no session cookie -> /login. It never decodes
// or trusts token claims. The dashboard layout checks the role, and the API's
// requireRole('ADMIN') is the real boundary.
export default function proxy(req: NextRequest) {
  const hasSession = req.cookies.has('hcp_admin_access') || req.cookies.has('hcp_admin_refresh');
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)'],
};
