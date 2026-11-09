import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COOPERATIVE_CHART_ADDITIONS,
  DEFAULT_CHART_OF_ACCOUNTS,
} from "@/constants/chart-of-accounts";
import { chartTemplateItems } from "../../_lib/select-items";
import {
  TEMPLATE_SUMMARIES,
  chartTemplateFromValue,
  seedPreviewRows,
  seedTemplateError,
} from "./seed-template";

const COOPERATIVE_CODES = COOPERATIVE_CHART_ADDITIONS.map((a) => a.code);

test("nothing is picked until a known template is chosen", () => {
  assert.equal(chartTemplateFromValue(null), null);
  assert.equal(chartTemplateFromValue(""), null);
  assert.equal(chartTemplateFromValue("corporate"), null);
  assert.equal(chartTemplateFromValue("lending_company"), "lending_company");
  assert.equal(chartTemplateFromValue("cooperative"), "cooperative");
});

test("each template the picker offers has a summary in words", () => {
  assert.deepEqual(
    chartTemplateItems.map((item) => [item.value, TEMPLATE_SUMMARIES[item.value as "cooperative"]]),
    [
      ["lending_company", "Lending company: capital and retained earnings"],
      [
        "cooperative",
        "Cooperative: share capital, statutory funds, undivided net surplus, savings and time deposits",
      ],
    ],
  );
});

test("the lending company preview is today's chart, with nothing marked Cooperative", () => {
  const rows = seedPreviewRows("lending_company");
  assert.deepEqual(
    rows.map((r) => r.code),
    DEFAULT_CHART_OF_ACCOUNTS.map((a) => a.code),
  );
  assert.equal(rows.some((r) => r.cooperative), false);
});

test("the cooperative preview marks exactly the ten additions, in code order", () => {
  const rows = seedPreviewRows("cooperative");
  assert.equal(rows.length, DEFAULT_CHART_OF_ACCOUNTS.length + 10);
  assert.deepEqual(
    rows.filter((r) => r.cooperative).map((r) => r.code),
    COOPERATIVE_CODES,
  );
  const codes = rows.map((r) => r.code);
  assert.deepEqual(codes, [...codes].sort());
});

test("no preview row or summary shows a dollar sign or a raw key", () => {
  for (const template of ["lending_company", "cooperative"] as const) {
    for (const row of seedPreviewRows(template)) {
      assert.doesNotMatch(row.name, /\$|_/, row.code);
    }
    assert.doesNotMatch(TEMPLATE_SUMMARIES[template], /\$|_/);
  }
});

test("a 422 on template shows the server's words", () => {
  const err = {
    response: {
      status: 422,
      data: {
        message: "The selected template is invalid.",
        errors: { template: ["The selected template is invalid."] },
      },
    },
  };
  assert.equal(seedTemplateError(err), "The selected template is invalid.");
});

test("other answers are not a template error", () => {
  assert.equal(seedTemplateError({ response: { status: 409, data: {} } }), null);
  assert.equal(
    seedTemplateError({ response: { status: 422, data: { errors: { name: ["Taken."] } } } }),
    null,
  );
  assert.equal(seedTemplateError(new Error("boom")), null);
});

test("the seed card sends the picked template and offers the template items", () => {
  const card = readFileSync(
    resolve(process.cwd(), "src/app/(app)/accounting/chart-of-accounts/_components/seed-chart-card.tsx"),
    "utf8",
  );
  assert.match(card, /accountingService\.seedAccounts\(template\)/);
  assert.match(card, /items=\{chartTemplateItems\}/);
  assert.match(card, /Which chart fits this organisation\?/);
  assert.match(card, /disabled=\{template === null\}/);
  assert.doesNotMatch(card, /seedAccounts\(\)/);
  assert.doesNotMatch(card, /["'](lending_company|cooperative)["']/);
});
