/**
 * The header the API checks to trust this server as its proxy hop
 * (lendyph-backend App\Http\Middleware\TrustFrontendProxy).
 *
 * Server only: imported by src/proxy.ts and nothing the browser loads.
 */
export const PROXY_SECRET_HEADER = "x-lendyph-proxy";

/**
 * The request headers to forward upstream: any browser-supplied copy of the
 * proxy header is dropped first, then the server's own secret is added when
 * one is configured. An empty or unset secret sends no header at all.
 */
export function withProxySecret(incoming: Headers, secret: string | undefined): Headers {
  const headers = new Headers(incoming);
  headers.delete(PROXY_SECRET_HEADER);

  const value = secret?.trim();
  if (value) headers.set(PROXY_SECRET_HEADER, value);

  return headers;
}
