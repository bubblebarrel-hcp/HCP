import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// CSP sources must be bare origins: BACKEND_API_URL carries an /api/v1 path,
// and a source with a path in it silently fails to match.
const backendOrigin = new URL(process.env.BACKEND_API_URL ?? "http://localhost:5010/api/v1").origin;

// The realtime socket (D72) connects from the browser straight to the API, the
// one thing that does: a socket cannot go through the same-origin proxy. A CSP
// source of http(s) does not always cover its ws(s) twin, so name both.
const realtimeOrigin = backendOrigin.replace(/^http/, "ws");

// Uploads go browser → storage directly (D28): the browser PUTs to a presigned
// URL on Cloudflare, which is a different origin from the API and so needs its
// own connect-src entry. The default covers R2's S3 endpoint for any bucket;
// MEDIA_UPLOAD_ORIGIN narrows it to one host, or names a different provider.
const uploadOrigin = process.env.MEDIA_UPLOAD_ORIGIN ?? "https://*.r2.cloudflarestorage.com";

const csp = [
  "default-src 'self'",
  // React's dev build uses eval for stack traces; production never does.
  // Google Maps (the Maps JavaScript API) loads its script from maps.googleapis.com, and
  // its vector map lays out labels in WebAssembly. 'wasm-unsafe-eval' allows that and
  // nothing more: it does not allow eval() or new Function(), unlike 'unsafe-eval'.
  // Because dev already has 'unsafe-eval', a policy gap like this only shows up in a
  // production build, so test the map there.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://maps.googleapis.com${isDev ? " 'unsafe-eval'" : ""}`,
  // The map pulls in a Roboto stylesheet from Google Fonts.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Kennel logos and banners are admin-supplied https URLs, and media served
  // from R2 is https too. In development the media fallback is the API's own
  // /uploads on plain http, so that origin has to be named (D28).
  `img-src 'self' data: blob: https:${isDev ? ` ${backendOrigin}` : ''}`,
  // Reels are <video>, which img-src does not cover: without this the browser
  // falls back to default-src 'self' and refuses every clip (R2 in production,
  // the API's /uploads in development), and the recorder's blob: preview too.
  `media-src 'self' blob: https:${isDev ? ` ${backendOrigin}` : ''}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  // Google's vector map renders in a web worker it builds from a blob: URL.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // The vector map fetches its tiles, styles and icons with fetch(), not <img>, so
  // Google's hosts have to be allowed here rather than in img-src (without them the map
  // draws grey), and it reads some images back as data: and blob: URLs. These follow
  // Google's own CSP guide for the Maps JavaScript API.
  `connect-src 'self' ${backendOrigin} ${realtimeOrigin} ${uploadOrigin} https://*.googleapis.com https://*.gstatic.com data: blob:${isDev ? " ws://localhost:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Inlined into the client bundle: where the realtime socket connects (D72).
  env: { NEXT_PUBLIC_REALTIME_URL: backendOrigin },
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
