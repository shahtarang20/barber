import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** Origin (https://host) of a URL from an env var, or null when unset / malformed. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

const r2Public = originOf(process.env.R2_PUBLIC_BASE_URL);
const r2Endpoint = originOf(process.env.R2_ENDPOINT);

// Content-Security-Policy. Next.js injects small inline scripts and this app has an inline head script, and a
// per-request nonce would force every page to render dynamically, so 'unsafe-inline' is kept for scripts/styles.
// Everything else is locked down: no plugins, no framing, no foreign form posts, connections only to known services.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  // Barbers may paste any https picture/video address into the catalogue, so https: is allowed for media.
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  // Pusher (live refresh), R2 (direct video upload), QR image download, same-origin API. FCM/web-push is sent by
  // the server and delivered by the browser's push service, so it needs no connect-src entry.
  ["connect-src 'self'", "https://*.pusher.com", "wss://*.pusher.com", "https://*.r2.cloudflarestorage.com", r2Public, r2Endpoint]
    .filter(Boolean)
    .join(" "),
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(isProd
    ? [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Content-Security-Policy", value: csp },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      ...(r2Public ? [{ protocol: "https" as const, hostname: new URL(r2Public).hostname }] : []),
      { protocol: "https" as const, hostname: "*.r2.dev" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "@base-ui/react"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private areas: never indexed (belt and braces with robots.txt).
      ...["/dashboard/:path*", "/admin/:path*", "/login", "/register", "/cancel", "/api/:path*"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      // The service worker must always be fetched fresh and may not be cached by the CDN.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
