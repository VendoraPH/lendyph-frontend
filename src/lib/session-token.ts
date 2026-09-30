/**
 * When the access token stops working, and when to renew it.
 *
 * The API's token has a fixed lifetime (login + 30 minutes for a normal
 * sign-in), and `POST /auth/refresh` is authenticated by the very token it
 * replaces. So a token can only be renewed while it is still valid: once it
 * has expired the refresh answers 401 like everything else. Renewal therefore
 * has to happen AHEAD of expiry, driven by the clock and the user's activity,
 * never in response to a 401.
 *
 * Pure functions, so the rules can be tested without a browser.
 */

/** When the token in hand was issued and when it stops working, in epoch ms. */
export interface TokenLifetime {
  issuedAt: number;
  expiresAt: number;
}

/**
 * The lifetime of a token the API has just issued.
 *
 * `expiresIn` is the `expires_in` the API returns with a token, in seconds.
 * It is measured from when the response arrived, not from a server timestamp,
 * so a workstation whose clock is off still renews on time. An API that does
 * not send it yet falls back to `fallbackMinutes`.
 */
export function tokenLifetime(
  expiresIn: unknown,
  now: number,
  fallbackMinutes: number,
): TokenLifetime {
  const seconds =
    typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0
      ? expiresIn
      : fallbackMinutes * 60;
  return { issuedAt: now, expiresAt: now + seconds * 1000 };
}

/** A lifetime read back from storage, or null when it is missing or garbled. */
export function parseTokenLifetime(raw: string | null): TokenLifetime | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      typeof (value as TokenLifetime).issuedAt === "number" &&
      typeof (value as TokenLifetime).expiresAt === "number"
    ) {
      return { issuedAt: (value as TokenLifetime).issuedAt, expiresAt: (value as TokenLifetime).expiresAt };
    }
  } catch {
    // Not JSON: treat as unknown, the same as a token stored before lifetimes were.
  }
  return null;
}

export function isTokenExpired(lifetime: TokenLifetime | null, now: number): boolean {
  return lifetime !== null && now >= lifetime.expiresAt;
}

/**
 * Whether to renew now.
 *
 * Once the token is past half its life, and only if the user has done
 * something since it was issued. That keeps the token alive for at least as
 * long as the idle window that follows the user's last action, since the
 * renewed token lasts a full lifetime from a moment at or after that action.
 * A user who has been idle since issue is left alone, and the idle timeout
 * signs them out before the token runs out.
 *
 * An already-expired token is not "due": refreshing it can only 401.
 */
export function isRenewalDue(
  lifetime: TokenLifetime | null,
  lastActivity: number,
  now: number,
): boolean {
  if (lifetime === null || isTokenExpired(lifetime, now)) return false;
  const halfLife = lifetime.issuedAt + (lifetime.expiresAt - lifetime.issuedAt) / 2;
  return now >= halfLife && lastActivity > lifetime.issuedAt;
}

/**
 * Whether an HTTP status from the API means the session itself was refused.
 *
 * Only an outright rejection does. A throttled request (429), a server error
 * or a dropped connection says nothing about whether the user is still signed
 * in, so treating one as a logout signs people out over a blip.
 */
export function isSessionRejection(status: number | undefined): boolean {
  return status === 401 || status === 403 || status === 419;
}

/** The token a request carried, from its `Authorization` header. */
export function bearerToken(header: unknown): string | null {
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/.exec(header);
  return match ? match[1] : null;
}

/**
 * What a 401 means for the request that got it.
 *
 * Every 401 from this API means the token that request carried is dead
 * (expired, idle-revoked, or revoked by a password change or logout). If that
 * was an older token and a newer one has since been stored (a renewal in this
 * tab or another rotated it while the request was in flight), the request is
 * simply replayed with the current one. Otherwise the session is over. A
 * refresh would carry the same rejected token and 401 as well.
 */
export function unauthorizedOutcome(
  sentWith: string | null,
  current: string | null,
): "replay" | "session-over" {
  return current !== null && sentWith !== current ? "replay" : "session-over";
}
