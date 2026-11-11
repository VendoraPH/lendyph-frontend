import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PROXY_SECRET_HEADER, withProxySecret } from "./proxy-secret";

const SECRET = "a".repeat(64);

test("adds the configured secret to the forwarded request", () => {
  const out = withProxySecret(new Headers({ accept: "application/json" }), SECRET);

  assert.equal(out.get(PROXY_SECRET_HEADER), SECRET);
  assert.equal(out.get("accept"), "application/json");
});

test("drops a browser-supplied copy before adding the server's own", () => {
  const incoming = new Headers({ "X-Lendyph-Proxy": "forged-by-the-browser" });

  assert.equal(withProxySecret(incoming, SECRET).get(PROXY_SECRET_HEADER), SECRET);
});

test("sends no header at all when the secret is unset or blank", () => {
  for (const secret of [undefined, "", "   "]) {
    const incoming = new Headers({ "x-lendyph-proxy": "forged-by-the-browser" });

    assert.equal(withProxySecret(incoming, secret).has(PROXY_SECRET_HEADER), false, String(secret));
  }
});

test("leaves the incoming headers untouched", () => {
  const incoming = new Headers({ "x-lendyph-proxy": "forged-by-the-browser" });
  withProxySecret(incoming, SECRET);

  assert.equal(incoming.get(PROXY_SECRET_HEADER), "forged-by-the-browser");
});

test("keeps X-Forwarded-For exactly as it arrived", () => {
  const incoming = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.10" });

  assert.equal(withProxySecret(incoming, SECRET).get("x-forwarded-for"), "6.6.6.6, 203.0.113.10");
});

// The secret must stay on the server: only src/proxy.ts may read it or import
// the helper, and no file may reach for a public copy of it.
test("only src/proxy.ts reads LENDYPH_PROXY_SECRET or imports the helper", () => {
  const src = join(__dirname, "..");
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(entry) || entry.endsWith(".test.ts")) continue;
      const rel = relative(src, path);
      if (rel === "proxy.ts" || rel === join("lib", "proxy-secret.ts")) continue;
      const text = readFileSync(path, "utf8");
      if (/LENDYPH_PROXY_SECRET|lib\/proxy-secret/.test(text)) offenders.push(rel);
    }
  };
  walk(src);

  assert.deepEqual(offenders, []);
});
