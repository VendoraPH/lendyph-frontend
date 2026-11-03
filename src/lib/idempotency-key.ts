/**
 * Client-minted idempotency keys (UUID v4).
 *
 * A form that moves money mints one key when it is opened and sends it with
 * every attempt to submit that form. If the response is lost and the user
 * presses the button again, the server recognises the key and hands back the
 * transaction the first attempt created instead of posting a second one.
 *
 * Shared by the public registration form (`registration-key.ts`, which also
 * persists its key across reloads) and the savings deposit, withdrawal and
 * transfer forms (`Idempotency-Key` header).
 *
 * Pure and dependency-free (the RNG is injectable) so it is unit-testable.
 */

// The backend validates `uuid:4`, so anything minted here is a v4: version
// nibble 4, variant 8/9/a/b.
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** HTTP header the savings endpoints read the key from. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

// Structural, not `Crypto`, so a test can pass a stub — the real `crypto`
// object satisfies it. Both members are optional because the whole point of
// this module is deciding what to do when they are missing.
export interface CryptoSource {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

export function isUuidV4(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

function defaultCrypto(): CryptoSource | null {
  return typeof globalThis.crypto === "object" ? globalThis.crypto : null;
}

/**
 * Mint a v4 UUID, or `null` if no CSPRNG is available.
 *
 * `Math.random()` is deliberately NOT a fallback and must never become one: a
 * registration key is a bearer credential for its submission window, and a
 * guessable key would let someone else's retry claim a row. If we cannot
 * generate a strong key we send none and simply lose idempotency for that
 * submission.
 *
 * `crypto.randomUUID` requires a secure context. `crypto.getRandomValues` does
 * not, so plain-HTTP dev origins (a phone hitting the LAN IP) still get a real
 * CSPRNG rather than a downgrade.
 */
export function mintIdempotencyKey(source?: CryptoSource | null): string | null {
  const crypto = source === undefined ? defaultCrypto() : source;
  if (!crypto) return null;

  if (typeof crypto.randomUUID === "function") {
    const uuid = crypto.randomUUID();
    // Trust but verify: a polyfilled `randomUUID` that returns something other
    // than a v4 would be rejected by the backend anyway.
    if (isUuidV4(uuid)) return uuid;
  }

  if (typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
      16,
      20
    )}-${hex.slice(20)}`;
  }

  return null;
}

/** Axios config carrying the key, or no header at all when none was minted. */
export function idempotencyHeaders(key: string | null): { headers?: Record<string, string> } {
  return key ? { headers: { [IDEMPOTENCY_HEADER]: key } } : {};
}
