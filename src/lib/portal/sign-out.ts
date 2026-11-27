import { logoutWith, portalTokens } from "./portal-client";

/**
 * Sign out on this device. The token and the member store are cleared first,
 * at once, so a slow or failed call can never leave the member signed in
 * here; then the server is asked, as a best effort with a short timeout, to
 * end that token too. The promise settles (never rejects) when the call has.
 */
export function signOutMember(clearLocal: () => void, send: (token: string) => Promise<unknown> = logoutWith): Promise<void> {
  const token = portalTokens.get();
  portalTokens.clear();
  clearLocal();
  if (!token) return Promise.resolve();
  return send(token).then(
    () => undefined,
    () => undefined,
  );
}
