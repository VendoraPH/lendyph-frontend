import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { forgetRememberMe, LEGACY_REMEMBER_ME_KEY } from "./remember-me";

// "Remember me for 30 days" is gone from the staff sign-in (finish run round
// 7, Pepito's QA task 14zfbg0eqfd, security): every session follows the normal
// idle rule, and the flag an older sign-in left in localStorage is cleared once
// on load.

const ROOT = resolve(process.cwd(), "src");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

function storage(entries: Record<string, string>) {
  const items = new Map(Object.entries(entries));
  return {
    removeItem: (key: string) => {
      items.delete(key);
    },
    items,
  };
}

describe("forgetRememberMe", () => {
  test("clears the flag an older sign-in stored", () => {
    const s = storage({ [LEGACY_REMEMBER_ME_KEY]: "true", lendy_access_token: "t" });
    forgetRememberMe(s);
    assert.equal(s.items.has(LEGACY_REMEMBER_ME_KEY), false);
    assert.equal(s.items.get("lendy_access_token"), "t", "other keys stay");
  });

  test("does nothing when there is no flag, or no storage", () => {
    const s = storage({ lendy_access_token: "t" });
    forgetRememberMe(s);
    assert.deepEqual([...s.items.keys()], ["lendy_access_token"]);
    assert.doesNotThrow(() => forgetRememberMe(undefined));
  });

  test("a storage that refuses access is left alone", () => {
    assert.doesNotThrow(() =>
      forgetRememberMe({
        removeItem: () => {
          throw new Error("SecurityError");
        },
      }),
    );
  });
});

describe("no remembered sign-in is left", () => {
  test("the staff sign-in offers no Remember me and sends no `remember`", () => {
    const page = readFileSync(join(ROOT, "app", "(auth)", "login", "page.tsx"), "utf8");
    assert.doesNotMatch(page, /Remember me/i);
    assert.doesNotMatch(page, /\bremember\b\s*:/);
    assert.doesNotMatch(page, /Checkbox/);
  });

  test("only the clean-up names the old flag, and nothing reads it", () => {
    const users = sources(ROOT)
      .filter((path) => readFileSync(path, "utf8").includes(LEGACY_REMEMBER_ME_KEY))
      .map((path) => relative(ROOT, path));
    assert.deepEqual(users, [join("lib", "remember-me.ts")]);
  });

  test("the session follows the idle rule for everyone", () => {
    const provider = readFileSync(join(ROOT, "components", "providers", "session-provider.tsx"), "utf8");
    assert.doesNotMatch(provider, /isRememberMe/);
    assert.match(provider, /forgetRememberMe\(/);
  });
});
