import type { NextConfig } from "next";

// Every browser request goes to the same-origin `/api/proxy` path (see
// src/lib/axios-client.ts) and is rewritten here, so this destination decides
// which backend — and therefore which tenant database — a deployment talks to.
// lendyph is single-tenant-per-deployment, so it MUST follow the instance's own
// NEXT_PUBLIC_API_URL rather than a hardcoded host: previously every deployment
// proxied to the shared api-lendyph instance, which meant the binhs-coop client
// site read and wrote the main app's database instead of its own.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
const apiUrl = new URL(API_URL);

const nextConfig: NextConfig = {
  images: {
    // Uploaded assets (logos, borrower photos) are served by whichever API this
    // instance talks to, so this has to track the same origin.
    remotePatterns: [
      {
        protocol: apiUrl.protocol === "https:" ? "https" : "http",
        hostname: apiUrl.hostname,
        pathname: "/storage/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${API_URL.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

export default nextConfig;
