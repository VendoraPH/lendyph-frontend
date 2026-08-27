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
  experimental: {
    // A valid-ID registration posts front_file AND back_file, each allowed up
    // to 10 MB by the API (`max:10240` KB), so a legitimate request can carry
    // ~20 MB plus multipart overhead. Next buffers the body of every proxied
    // request and caps that buffer at 10 MB by default
    // (`experimental.proxyClientMaxBodySize`, node_modules/next/dist/server/
    // config-shared.js).
    //
    // Over the cap the request does not fail cleanly. Verified locally against
    // a stub API: at 15 MB the default logs "Request body exceeded 10MB for
    // /api/proxy/borrowers", the upstream never receives the request at all,
    // and the browser is left waiting until axios gives up — no status, no
    // response, which is exactly the "no internet connection" toast the public
    // form was showing people who were in fact online. With the cap raised, the
    // same 15 MB POST arrives upstream byte-for-byte.
    //
    // 25 MB, not more: production nginx (`client_max_body_size 25M`) and
    // PHP-FPM (`post_max_size 25M`) 413 anything larger anyway, so buffering
    // past that only holds bytes the API will refuse. Next CLONES the buffered
    // body, so the ceiling costs roughly 2x resident memory per in-flight
    // request — on an unauthenticated, public endpoint. 25 MB still clears the
    // ~20 MB legitimate maximum plus multipart overhead.
    // Docs: node_modules/next/dist/docs/01-app/03-api-reference/05-config/
    //       01-next-config-js/proxyClientMaxBodySize.md
    proxyClientMaxBodySize: "25mb",

    // The client, not the proxy, decides when to stop waiting.
    //
    // Next caps the proxy -> API hop at 30 000 ms by default (`proxyTimeout ||
    // 30000` in node_modules/next/dist/server/lib/router-utils/
    // proxy-request.js, fed from here via router-server.js). That is BELOW the
    // 60 s axios timeout in src/config/env.ts, so the proxy always won the
    // race, and that is wrong twice over:
    //
    //  1. Copy. On expiry the proxy answers a bare 500 ("Internal Server
    //     Error", onProxyError), which the UI reports as "Something went wrong
    //     on our end" — it reads as definitely-failed for a write that may well
    //     have committed. Confirmed in a browser: a create whose response never
    //     arrived surfaced exactly that, instead of the "your submission may
    //     still have gone through, wait before retrying" wording.
    //  2. It is the reported bug, one layer along. A two-sided valid-ID upload
    //     is ~20 MB; on Philippine mobile data inside a Facebook in-app browser
    //     that plausibly needs more than 30 s just to transfer. A 30 s ceiling
    //     kills submissions that would have succeeded — the same failure the
    //     10 MB body cap above was causing.
    //
    // The trade, for whoever tunes this next, in both directions: at 90 s a
    // hung backend occupies a Next connection ~3x longer than it used to. That
    // is accepted deliberately — the alternative is killing uploads that would
    // have completed — but it is the cost of this number, and the reason not to
    // raise it much further. Keep it ABOVE env.api.timeout so axios stays the
    // deciding party; if that 60 s ever rises, this has to rise with it.
    proxyTimeout: 90000,
  },
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
