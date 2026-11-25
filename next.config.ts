import type { NextConfig } from "next";

/**
 * Internal address of the Express backend. The sandbox gateway routes
 * /api?XTransformPort=… straight to the backend, but listing media URLs
 * (/api/media/…) are plain <img> srcs without that query — Next proxies
 * them here so they resolve from every origin the SPA is served on.
 */
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3030";

/**
 * Baseline security headers for every page. A full Content-Security-Policy
 * is not set yet: the app loads media from a configurable origin (local
 * /api/media or the R2 CDN) and would need that origin wired in first.
 */
const SECURITY_HEADERS = [
  // Refuse to be framed (clickjacking on login / payment pages).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never leak reset tokens or case URLs to third-party sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Hide the floating dev-mode badge (route indicator / build activity) so
  // the preview shows only the product UI.
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/media/:path*",
        destination: `${BACKEND_INTERNAL_URL}/api/media/:path*`,
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
