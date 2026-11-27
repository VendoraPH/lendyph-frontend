import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOGO, logoToShow, rememberLogoMissing } from "./logo";

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}
Object.assign(globalThis, { sessionStorage: new MemoryStorage(), window: new EventTarget() });

test("no logo_url in the config: the bundled logo, with no request", () => {
  assert.equal(logoToShow(null), DEFAULT_LOGO);
  assert.equal(logoToShow(undefined), DEFAULT_LOGO);
  assert.equal(logoToShow(""), DEFAULT_LOGO);
  assert.equal(logoToShow("https://evil.example/logo.png"), DEFAULT_LOGO);
});

test("a logo_url is requested until it answers 404 once; then this tab never asks again", () => {
  assert.equal(logoToShow("/branding/logo"), "/api/proxy/branding/logo");
  rememberLogoMissing("/api/proxy/branding/logo");
  assert.equal(logoToShow("/branding/logo"), DEFAULT_LOGO);
});
