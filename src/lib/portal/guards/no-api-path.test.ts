import { test } from "node:test";
import assert from "node:assert/strict";
import { codeOf, memberSources } from "./sources";

// Members never see an API path (round fx): the portal's paths live in
// lib/portal/endpoints.ts only, and the client's same-origin base is the one
// "/api/" string. No page, component or message spells a path out.
const PATH_OWNERS = new Set(["lib/portal/endpoints.ts", "lib/portal/portal-client.ts"]);
const API_PATH = /["'`](?:[A-Z]+ )?\/(?:api|portal|portal-admin|sanctum)\/[^"'`]*["'`]/;
/** A path in JSX text: after a tag, or on a text line of its own. */
const JSX_TEXT_PATH = /(?:^|>)[^"'`<>{}=]*\/(?:api|portal|portal-admin|sanctum)\//;

export function pathFindings(source: string): string[] {
  const found: string[] = [];
  source.split("\n").forEach((line, index) => {
    const code = codeOf(line);
    if (API_PATH.test(code) || JSX_TEXT_PATH.test(code)) found.push(`line ${index + 1}`);
  });
  return found;
}

for (const { file, text } of memberSources().filter((s) => !PATH_OWNERS.has(s.file))) {
  test(`${file} spells out no API path`, () => {
    assert.deepEqual(pathFindings(text), []);
  });
}

test("the client's only path is the same-origin proxy", () => {
  const client = memberSources(["lib/portal/portal-client.ts"])[0].text;
  const paths = client.match(/["'`]\/[a-z][^"'`]*["'`]/g) ?? [];
  assert.deepEqual(paths, ['"/api/proxy"']);
});

for (const [line, caught] of [
  ['<p>Waiting on "/portal/loans"</p>', true],
  ["const url = `/portal/requests/${id}`;", true],
  ['notifyError(err, "GET /api/portal/dashboard failed");', true],
  ['const where = "/api/proxy/portal/loans";', true],
  ["<p>Waiting on /portal/loans</p>", true],
  ["          GET /api/portal/dashboard failed", true],
  ["<dd>See /portal-admin/requests for details</dd>", true],
  ['router.push("/member/requests");', false],
  ['<Link href="/member/requests">Requests</Link>', false],
  ['} from "@/lib/portal/portal-api";', false],
  ['import { portalService } from "@/lib/portal/portal-api";', false],
] as const) {
  test(`the scan ${caught ? "catches" : "allows"}: ${line}`, () => {
    assert.equal(pathFindings(line).length > 0, caught);
  });
}
