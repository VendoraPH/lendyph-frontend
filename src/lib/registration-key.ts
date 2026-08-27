/**
 * Idempotency key for the public registration form.
 *
 * The failure this exists to stop: the applicant submits, the response is lost
 * (timeout, tab killed, phone drops the connection) and the borrower row was
 * created anyway. Their retry then collides with the record their own first
 * attempt made, and they are told they are "already registered" for a
 * registration nobody can see yet.
 *
 * With a key, `POST /borrowers` recognises the retry and hands back the row the
 * first attempt created, plus a fresh submission token, instead of rejecting
 * it. The key is minted once per attempt at the form and parked in
 * sessionStorage, so a reload — which throws away all React state — resubmits
 * under the same key rather than creating a twin.
 *
 * Pure and dependency-free (both the RNG and the store are injectable) so it is
 * unit-testable via `tsx --test`.
 */

// sessionStorage, not localStorage: the key must not outlive the tab. A stale
// key from last week can only ever be refused by the server (see
// isStaleRegistrationKeyError), and clearing on success is not enough on its
// own — an abandoned attempt never reaches the success page.
const STORAGE_KEY = "lendyph.registration_key";

// The backend accepts `uuid` today and is tightening to `uuid:4`, so anything
// we mint or replay has to be a v4: version nibble 4, variant 8/9/a/b.
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Structural, not `Crypto`, so a test can pass a stub — the real `crypto`
// object satisfies it. Both members are optional because the whole point of
// this module is deciding what to do when they are missing.
export interface CryptoSource {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

export interface KeyStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface KeyEnvironment {
  crypto?: CryptoSource | null;
  storage?: KeyStore | null;
}

export function isRegistrationKey(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

function defaultCrypto(): CryptoSource | null {
  return typeof globalThis.crypto === "object" ? globalThis.crypto : null;
}

// Reading sessionStorage can THROW, not just return null (Safari lockdown,
// third-party-cookie blocking in an in-app browser — and this form is reached
// from a Facebook in-app browser often enough to matter). Every access is
// guarded, and a dead store degrades to "no persistence", never to a crash.
function defaultStorage(): KeyStore | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function read(storage: KeyStore | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(storage: KeyStore | null, value: string): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, value);
  } catch {
    // Persistence is an optimisation for the reload case. The key still works
    // for a retry within this page instance, so a full store is not fatal.
  }
}

/**
 * Mint a v4 UUID, or `null` if no CSPRNG is available.
 *
 * `Math.random()` is deliberately NOT a fallback and must never become one.
 * A key is a bearer credential for the 15-minute submission window: presenting
 * one returns the matching pending row and a token that can write to its KYC
 * uploads. 122 bits from a CSPRNG makes guessing one hopeless; `Math.random()`
 * (or a timestamp-derived v1/v7) would make it a search space small enough to
 * probe. If we cannot generate a strong key we send no key at all and simply
 * lose idempotency for that submission — strictly the behaviour we had before.
 *
 * `crypto.randomUUID` requires a secure context. `crypto.getRandomValues` does
 * not, so plain-HTTP dev origins (a phone hitting the LAN IP) still get a real
 * CSPRNG rather than a downgrade.
 */
export function mintRegistrationKey(source?: CryptoSource | null): string | null {
  const crypto = source === undefined ? defaultCrypto() : source;
  if (!crypto) return null;

  if (typeof crypto.randomUUID === "function") {
    const uuid = crypto.randomUUID();
    // Trust but verify: a polyfilled `randomUUID` that returns something other
    // than a v4 would be rejected by the backend anyway.
    if (isRegistrationKey(uuid)) return uuid;
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

/**
 * The key for this attempt at the form: the one already stored, or a new one.
 *
 * Returns `null` when no CSPRNG is available, in which case the caller must
 * omit `registration_uuid` entirely rather than send a weak value.
 */
export function getOrCreateRegistrationKey(env: KeyEnvironment = {}): string | null {
  const storage = env.storage === undefined ? defaultStorage() : env.storage;

  const stored = read(storage);
  // Anything that is not a v4 (truncated write, hand-edited value, a key from
  // an older format) is discarded rather than sent for the server to reject.
  if (isRegistrationKey(stored)) return stored;

  const minted = mintRegistrationKey(env.crypto);
  if (!minted) return null;

  write(storage, minted);
  return minted;
}

/**
 * Drop the key so the next submission is a genuinely new registration.
 *
 * Called on success, and when the server refuses the key as spent.
 */
export function clearRegistrationKey(env: KeyEnvironment = {}): void {
  const storage = env.storage === undefined ? defaultStorage() : env.storage;
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — a store that cannot delete also could not persist.
  }
}

/**
 * True when a 422 refused the key itself: it belongs to a row this caller
 * cannot be handed back (already approved or rejected, or older than the
 * submission window), and the server is telling the applicant to start a new
 * registration. Keyed on the FIELD NAME rather than the copy so rewording the
 * backend message cannot silently strand people.
 *
 * Without this the stored key is a trap: every retry resends the same dead key
 * and gets the same refusal, and the applicant can never submit again from
 * that tab.
 */
export function isStaleRegistrationKeyError(err: unknown): boolean {
  if (!err || typeof err !== "object" || !("response" in err)) return false;
  const response = (err as { response?: { data?: { errors?: unknown } } }).response;
  const errors = response?.data?.errors;
  if (!errors || typeof errors !== "object") return false;
  return "registration_uuid" in (errors as Record<string, unknown>);
}
