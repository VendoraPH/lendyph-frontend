/**
 * Client-minted idempotency keys (UUID v4) for forms that create a record the
 * server must never create twice, such as a deposit, a withdrawal or a
 * transfer.
 *
 * One key per attempt at a submit, sent with every try of that attempt. If the
 * response is lost and the user presses the button again, the server
 * recognises the key and hands back what the first try created instead of
 * posting a second one. `useSubmitGuard` decides when an attempt ends.
 *
 * Minting reuses the public registration form's minter (`registration-key.ts`)
 * so there is one CSPRNG-only implementation: never `Math.random()`, and no
 * key at all when no CSPRNG exists.
 */

import { isRegistrationKey, mintRegistrationKey, type CryptoSource } from "./registration-key";

export type { CryptoSource };

/** The HTTP header the server reads the key from. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** True for a v4 UUID, the only form the server accepts. */
export function isUuidV4(value: unknown): value is string {
  return isRegistrationKey(value);
}

/** A fresh v4 UUID, or `null` when no CSPRNG is available. */
export function mintIdempotencyKey(source?: CryptoSource | null): string | null {
  return mintRegistrationKey(source);
}

/** Axios config carrying the key, or no header at all when none was minted. */
export function idempotencyHeaders(key: string | null): { headers?: Record<string, string> } {
  return key ? { headers: { [IDEMPOTENCY_HEADER]: key } } : {};
}
