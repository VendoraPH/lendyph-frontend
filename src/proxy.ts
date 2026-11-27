import { NextResponse, type NextRequest } from "next/server";
import { withProxySecret } from "./lib/proxy-secret";

/**
 * Every browser call to the API goes through the same-origin /api/proxy/*
 * rewrite in next.config.ts, so the API sees this server's address for every
 * visitor. Here, on the server only, the request forwarded upstream gets the
 * shared secret that lets the API trust this hop's X-Forwarded-For.
 *
 * The secret is read from LENDYPH_PROXY_SECRET at request time. It is never
 * NEXT_PUBLIC_, so it is never inlined into a bundle, and it travels only on
 * the upstream request, never on a response.
 */
export function proxy(request: NextRequest) {
  return NextResponse.next({
    request: { headers: withProxySecret(request.headers, process.env.LENDYPH_PROXY_SECRET) },
  });
}

export const config = {
  matcher: "/api/proxy/:path*",
};
