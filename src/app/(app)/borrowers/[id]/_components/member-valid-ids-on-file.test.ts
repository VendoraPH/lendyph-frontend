import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemberValidIdsOnFile } from "./member-valid-ids-on-file";

const ids = [
  {
    id: 4,
    type: "passport",
    custom_type_name: null,
    id_number: "P1234567A",
    front_url: null,
    back_url: null,
    created_at: "2026-11-10T02:00:00Z",
  },
];

function render(status: "loading" | "ready" | "error", list = ids): string {
  return renderToStaticMarkup(createElement(MemberValidIdsOnFile, { ids: list, status, onRetry: () => {} }));
}

test("the IDs on file read in words, each with its upload date", () => {
  const html = render("ready");
  assert.match(html, /IDs on file/);
  assert.match(html, /Passport P1234567A/);
  assert.match(html, /Nov 10, 2026/);
});

test("loading, empty and failed lists each say so", () => {
  assert.match(render("loading"), /role="status"/);
  assert.match(render("ready", []), /No IDs on file yet\./);
  const failed = render("error");
  assert.match(failed, /We couldn&#x27;t load the IDs on file\./);
  assert.match(failed, /<button[^>]*type="button"[^>]*>Retry<\/button>/);
});
