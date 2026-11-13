import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { signOut } from "./sign-out";

function harness(opts: { token?: string | null; logoutFails?: boolean } = {}) {
  let stored: string | null = opts.token === undefined ? "old" : opts.token;
  const steps: string[] = [];
  let release: () => void = () => {};
  const deps = {
    getAccessToken: () => stored,
    clearTokens: () => {
      steps.push("clear");
      stored = null;
    },
    logout: (token: string) => {
      steps.push(`logout ${token} (stored: ${stored ?? "none"})`);
      return new Promise<void>((resolve, reject) => {
        release = () => (opts.logoutFails ? reject(new Error("offline")) : resolve());
      });
    },
  };
  return { deps, steps, release: () => release(), stored: () => stored };
}

describe("signOut", () => {
  test("clears the stored tokens before Log out goes out, and sends the token in hand", async () => {
    const h = harness();
    const done = signOut(h.deps);

    // Storage is already empty while Log out is still out, so the bell and the
    // badge stop at once and a 401 meanwhile finds no session to expire.
    assert.equal(h.stored(), null);
    assert.deepEqual(h.steps, ["clear", "logout old (stored: none)"]);

    h.release();
    await done;
  });

  test("a failed Log out still signs out locally", async () => {
    const h = harness({ logoutFails: true });
    const done = signOut(h.deps);
    h.release();
    await done;
    assert.equal(h.stored(), null);
    assert.deepEqual(h.steps, ["clear", "logout old (stored: none)"]);
  });

  test("with no token stored there is nothing to revoke: no request", async () => {
    const h = harness({ token: null });
    await signOut(h.deps);
    assert.deepEqual(h.steps, ["clear"]);
  });
});
