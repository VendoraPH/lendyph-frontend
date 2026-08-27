import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearRegistrationKey,
  getOrCreateRegistrationKey,
  isRegistrationKey,
  isStaleRegistrationKeyError,
  mintRegistrationKey,
  type CryptoSource,
  type KeyStore,
} from "./registration-key";

const STORAGE_KEY = "lendyph.registration_key";

function fakeStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const store: KeyStore & { map: Map<string, string> } = {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
  return store;
}

// Deterministic CSPRNG stand-in: every byte the same, so the version/variant
// rewrite is visible in the output.
const filledWith = (byte: number): CryptoSource => ({
  getRandomValues: (array: Uint8Array) => {
    array.fill(byte);
    return array;
  },
});

// --- minting -----------------------------------------------------------------

test("mint prefers crypto.randomUUID when it is available", () => {
  const uuid = "3f7a1c2e-9b4d-4e6f-8a1b-2c3d4e5f6a7b";
  let calls = 0;
  const source: CryptoSource = {
    randomUUID: () => {
      calls += 1;
      return uuid;
    },
    getRandomValues: () => assert.fail("getRandomValues must not run when randomUUID exists"),
  };
  assert.equal(mintRegistrationKey(source), uuid);
  assert.equal(calls, 1);
});

test("mint falls back to getRandomValues in a non-secure context", () => {
  // randomUUID is undefined on plain-HTTP origins; getRandomValues is not.
  assert.equal(
    mintRegistrationKey(filledWith(0xff)),
    "ffffffff-ffff-4fff-bfff-ffffffffffff"
  );
  assert.equal(
    mintRegistrationKey(filledWith(0x00)),
    "00000000-0000-4000-8000-000000000000"
  );
});

test("the fallback sets the v4 version and RFC 4122 variant bits", () => {
  for (const byte of [0x00, 0x0f, 0x55, 0xaa, 0xff]) {
    const uuid = mintRegistrationKey(filledWith(byte));
    assert.ok(isRegistrationKey(uuid), `not a v4 for byte ${byte}: ${uuid}`);
    assert.equal(uuid!.charAt(14), "4", "version nibble");
    assert.ok("89ab".includes(uuid!.charAt(19).toLowerCase()), "variant nibble");
  }
});

// The whole point of the key is that it cannot be guessed: it buys the pending
// row and a token that can write to that applicant's KYC uploads. Math.random
// is not a CSPRNG, so it must never be reachable — not even as a last resort.
test("mint never falls back to Math.random", () => {
  const realRandom = Math.random;
  Math.random = () => {
    throw new Error("Math.random must never be used to mint a registration key");
  };
  try {
    assert.ok(isRegistrationKey(mintRegistrationKey(filledWith(0x42))));
    // And with no CSPRNG at all it gives up rather than improvising.
    assert.equal(mintRegistrationKey({}), null);
  } finally {
    Math.random = realRandom;
  }
});

test("mint returns null when no CSPRNG is available, so the field is omitted", () => {
  assert.equal(mintRegistrationKey({}), null);
  assert.equal(mintRegistrationKey(null), null);
});

test("a polyfilled randomUUID that is not v4 is discarded, not sent", () => {
  const source: CryptoSource = {
    // v1-shaped: time-derived, and rejected by the backend's uuid:4 rule.
    randomUUID: () => "3f7a1c2e-9b4d-1e6f-8a1b-2c3d4e5f6a7b",
    ...filledWith(0x11),
  };
  assert.equal(mintRegistrationKey(source), "11111111-1111-4111-9111-111111111111");
});

test("minted keys are unique", () => {
  const keys = new Set(Array.from({ length: 200 }, () => mintRegistrationKey()));
  assert.equal(keys.size, 200);
  for (const key of keys) assert.ok(isRegistrationKey(key));
});

// --- persistence across a reload ---------------------------------------------

test("the same key is replayed on a second attempt (the reload case)", () => {
  const storage = fakeStore();
  const first = getOrCreateRegistrationKey({ storage });
  const second = getOrCreateRegistrationKey({ storage });
  assert.ok(isRegistrationKey(first));
  assert.equal(second, first);
  // Locks the storage key name: renaming it would silently stop a reloaded
  // form from recognising its own in-flight submission.
  assert.equal(storage.map.get(STORAGE_KEY), first);
});

test("a stored value that is not a v4 is replaced rather than sent", () => {
  const storage = fakeStore({ [STORAGE_KEY]: "not-a-uuid" });
  const key = getOrCreateRegistrationKey({ storage });
  assert.ok(isRegistrationKey(key));
  assert.notEqual(key, "not-a-uuid");
  assert.equal(storage.map.get(STORAGE_KEY), key);
});

test("no CSPRNG means no key at all, and nothing is persisted", () => {
  const storage = fakeStore();
  assert.equal(getOrCreateRegistrationKey({ storage, crypto: {} }), null);
  assert.equal(storage.map.size, 0);
});

// sessionStorage can throw outright (Safari lockdown, an in-app browser with
// storage blocked) — the form still has to submit.
test("a storage that throws still yields a usable key", () => {
  const hostile: KeyStore = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("SecurityError");
    },
  };
  assert.ok(isRegistrationKey(getOrCreateRegistrationKey({ storage: hostile })));
  assert.doesNotThrow(() => clearRegistrationKey({ storage: hostile }));
});

test("no storage at all (SSR) still mints without throwing", () => {
  assert.ok(isRegistrationKey(getOrCreateRegistrationKey({ storage: null })));
});

test("clearing means the next registration on this device gets a fresh key", () => {
  const storage = fakeStore();
  const first = getOrCreateRegistrationKey({ storage });
  clearRegistrationKey({ storage });
  assert.equal(storage.map.size, 0);
  const second = getOrCreateRegistrationKey({ storage });
  assert.ok(isRegistrationKey(second));
  assert.notEqual(second, first);
});

// --- a key the server refuses ------------------------------------------------

test("a 422 naming registration_uuid is recognised as a spent key", () => {
  const err = {
    response: {
      status: 422,
      data: {
        errors: {
          registration_uuid: [
            "This submission has already been recorded. Please start a new registration.",
          ],
        },
      },
    },
  };
  assert.equal(isStaleRegistrationKeyError(err), true);
});

test("an ordinary validation 422 is not treated as a spent key", () => {
  const err = {
    response: { status: 422, data: { errors: { email: ["Enter a valid email address"] } } },
  };
  assert.equal(isStaleRegistrationKeyError(err), false);
});

test("network errors and junk are not treated as a spent key", () => {
  assert.equal(isStaleRegistrationKeyError({ code: "ECONNABORTED" }), false);
  assert.equal(isStaleRegistrationKeyError({ response: { status: 500 } }), false);
  assert.equal(isStaleRegistrationKeyError(new Error("Network Error")), false);
  assert.equal(isStaleRegistrationKeyError(null), false);
  assert.equal(isStaleRegistrationKeyError(undefined), false);
});

test("isRegistrationKey rejects near-misses", () => {
  assert.equal(isRegistrationKey("3f7a1c2e-9b4d-4e6f-8a1b-2c3d4e5f6a7b"), true);
  assert.equal(isRegistrationKey("3f7a1c2e-9b4d-1e6f-8a1b-2c3d4e5f6a7b"), false); // v1
  assert.equal(isRegistrationKey("3f7a1c2e-9b4d-4e6f-ca1b-2c3d4e5f6a7b"), false); // variant
  assert.equal(isRegistrationKey("3f7a1c2e9b4d4e6f8a1b2c3d4e5f6a7b"), false); // unhyphenated
  assert.equal(isRegistrationKey(""), false);
  assert.equal(isRegistrationKey(null), false);
  assert.equal(isRegistrationKey(42), false);
});
