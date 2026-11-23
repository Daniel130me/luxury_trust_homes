import type { NextConfig } from "next";

/**
 * Internal address of the Express backend. The sandbox gateway routes
 * /api?XTransformPort=… straight to the backend, but listing media URLs
 * (/api/media/…) are plain <img> srcs without that query — Next proxies
 * them here so they resolve from every origin the SPA is served on.
 */
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3030";

const nextConfig: NextConfig = {
  output: "standalone",
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
