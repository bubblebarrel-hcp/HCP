import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP sources must be bare origins: BACKEND_API_URL carries an /api/v1 path,
// and a source with a path in it silently fails to match.
const backendOrigin = new URL(process.env.BACKEND_API_URL ?? "http://localhost:5010/api/v1").origin;

const csp = [
  "default-src 'self'",
  // React's dev build uses eval for stack traces; production never does.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // R2 media is https; in development the fallback is the API's own /uploads
  // on plain http, so that origin has to be named (D28).
  `img-src 'self' data: blob: https:${isDev ? ` ${backendOrigin}` : ''}`,
  "font-src 'self' data:",
  `connect-src 'self' ${backendOrigin}${isDev ? " ws://localhost:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  // The admin is never framed.
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
