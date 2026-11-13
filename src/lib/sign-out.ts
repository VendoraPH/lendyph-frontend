/**
 * A deliberate sign-out (the header's Log out, and the change-password page's).
 *
 * The stored tokens are cleared first, before Log out goes out, and Log out
 * carries the token in hand explicitly (the request interceptor only adds one
 * while a token is stored). With storage already empty, the background pollers
 * (the bell, the "awaiting me" badge) stop at once, and a 401 that comes back
 * meanwhile finds no session to expire, so no "Session Expired" dialog shows.
 *
 * Log out is best effort: the token may already be revoked, or the network
 * down. Signing out locally always succeeds.
 */
export interface SignOutDeps {
  getAccessToken: () => string | null;
  clearTokens: () => void;
  /** Revokes `token` on the server. */
  logout: (token: string) => Promise<unknown>;
}

export async function signOut(deps: SignOutDeps): Promise<void> {
  const token = deps.getAccessToken();
  deps.clearTokens();
  if (token === null) return;
  try {
    await deps.logout(token);
  } catch {
    // Best effort: at worst the token runs out on its own.
  }
}
