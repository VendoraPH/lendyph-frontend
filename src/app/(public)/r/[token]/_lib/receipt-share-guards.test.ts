import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Receipt share links (finish run round 2, decision 6), read from source:
 * layouts and pages are components, which `tsx --test` doesn't render.
 *
 * - Behind NEXT_PUBLIC_ENABLE_RECEIPT_SHARE_LINKS, off by default, on both
 *   sides: the receipt page's "Share link" and the public /r/{token} page.
 * - The public page never sends the staff token: its own axios instance, never
 *   the staff client.
 * - It shows the server's masked receipt as sent: no balances, next due date,
 *   account number or collector, and no money worked out in the browser.
 */
const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const PUBLIC_ROOTS = ["src/app/(public)/r", "src/services/public-receipt.service.ts"];

function sources(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return sources(child);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

const PUBLIC_FILES = PUBLIC_ROOTS.flatMap((root) => sources(join(ROOT, root)));

/** The comment-free code of a file; comments may name what the page never shows. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => (line.trim().startsWith("//") ? "" : line.replace(/\s\/\/\s.*$/, "")))
    .join("\n");
}

test("the flag is read literally, so Next inlines it into the browser bundle", () => {
  assert.match(read("src/config/env.ts"), /receiptShareLinks: parseBoolEnvValue\(process\.env\.NEXT_PUBLIC_ENABLE_RECEIPT_SHARE_LINKS\)/);
});

test("the flag is documented in .env.example and off there", () => {
  assert.match(read(".env.example"), /^NEXT_PUBLIC_ENABLE_RECEIPT_SHARE_LINKS=false$/m);
});

test("the public page answers not found while the flag is off, and asks not to be indexed", () => {
  const layout = read("src/app/(public)/r/[token]/layout.tsx");
  assert.match(layout, /if \(!env\.features\.receiptShareLinks\) notFound\(\);/);
  assert.match(layout, /robots: \{ index: false, follow: false \}/);
});

test("the receipt page offers Share link beside Download Image, only when the flag is on and the server answers", () => {
  const page = read("src/app/(app)/payments/[id]/page.tsx");
  assert.match(page, /<ShareReceiptLink repaymentId=\{receipt\.id\} \/>\s*<DownloadReceiptImageButton/);

  const button = code(read("src/app/(app)/payments/_components/share-receipt-link.tsx"));
  assert.match(button, /useApiResource\(fetchStatus, env\.features\.receiptShareLinks\)/);
  assert.match(button, /if \(!status\.data\) return null;/);
});

test("the public sources exist to be checked", () => {
  for (const root of PUBLIC_ROOTS) assert.ok(existsSync(join(ROOT, root)), root);
  assert.ok(PUBLIC_FILES.length >= 4, `checked ${PUBLIC_FILES.length} files`);
});

for (const file of PUBLIC_FILES) {
  const name = relative(ROOT, file);
  const source = code(readFileSync(file, "utf8"));

  test(`${name} never reaches the staff client or a staff token`, () => {
    assert.doesNotMatch(source, /@\/lib\/(api-client|axios-client)|@\/services["']|tokenManager|localStorage|Authorization/);
  });

  test(`${name} shows nothing the masked receipt leaves out`, () => {
    assert.doesNotMatch(source, /balance|next_due|loan_account|collected_by|received_by|contact|borrower_code|remarks|void_reason/i);
  });

  test(`${name} works out no money`, () => {
    assert.doesNotMatch(source, /\.reduce\s*\(|[+\-*/]=|\bparseFloat\s*\(|\bparseAmount\s*\(/);
    assert.doesNotMatch(source, /_applied\s+[-+*/]\s|amount_paid\s+[-+*/]\s|\$\s?\d|\bUSD\b/);
  });
}

test("the public service uses its own axios instance and sends only Accept", () => {
  const service = read("src/services/public-receipt.service.ts");
  assert.match(service, /axios\.create\(/);
  assert.match(service, /headers: \{ Accept: "application\/json" \}/);
});
