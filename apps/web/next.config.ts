import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP sources must be bare origins: BACKEND_API_URL carries an /api/v1 path,
// and a source with a path in it silently fails to match.
const backendOrigin = new URL(process.env.BACKEND_API_URL ?? "http://localhost:5010/api/v1").origin;

// Uploads go browser → storage directly (D28): the browser PUTs to a presigned
// URL on Cloudflare, which is a different origin from the API and so needs its
// own connect-src entry. The default covers R2's S3 endpoint for any bucket;
// MEDIA_UPLOAD_ORIGIN narrows it to one host, or names a different provider.
const uploadOrigin = process.env.MEDIA_UPLOAD_ORIGIN ?? "https://*.r2.cloudflarestorage.com";

const csp = [
  "default-src 'self'",
  // React's dev build uses eval for stack traces; production never does.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Kennel logos and banners are admin-supplied https URLs, and media served
  // from R2 is https too. In development the media fallback is the API's own
  // /uploads on plain http, so that origin has to be named (D28).
  `img-src 'self' data: blob: https:${isDev ? ` ${backendOrigin}` : ''}`,
  // Reels are <video>, which img-src does not cover: without this the browser
  // falls back to default-src 'self' and refuses every clip (R2 in production,
  // the API's /uploads in development), and the recorder's blob: preview too.
  `media-src 'self' blob: https:${isDev ? ` ${backendOrigin}` : ''}`,
  "font-src 'self' data:",
  // MapLibre does its GeoJSON and vector work in a web worker it builds from a
  // blob: URL. Without this the worker is refused, silently: raster tiles and
  // DOM markers still draw, but the trail's route line never does.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // MapLibre fetches raster tiles with fetch(), not <img>, so the tile host has
  // to be allowed here rather than in img-src. Without it both maps draw their
  // markers over a blank background (D15).
  `connect-src 'self' ${backendOrigin} ${uploadOrigin} https://tile.openstreetmap.org${isDev ? " ws://localhost:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
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
          // Geolocation stays available for check-in and trail features later.
          // Camera and microphone are this origin's own: the reel recorder (D47)
          // asks for both, and `camera=()` would refuse it for everyone.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
