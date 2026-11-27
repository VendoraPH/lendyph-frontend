import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LindaModelOption } from "@/types/linda";
import { LindaModelChoice } from "./linda-model-option";

const HAIKU: LindaModelOption = {
  id: "claude-haiku-5-5",
  label: "Claude Haiku 5.5",
  description: "Fast and low cost.",
  input_per_million: "6.20",
  output_per_million: "31.00",
  per_question: "0.01",
};

const render = (inUse: boolean, checked = inUse) =>
  renderToStaticMarkup(
    createElement(LindaModelChoice, { model: HAIKU, inUse, checked, disabled: false, onSelect: () => {} }),
  );

const radios = (html: string) => html.match(/<input[^>]*type="radio"[^>]*>|role="radio"/g) ?? [];

// Browser check: each option exposed a second, unnamed radio (the primitive's
// hidden input) and read "Claude Haiku 5.5In use".
test("each model option is exactly one radio, named by the model and the in-use mark", () => {
  const html = render(true);
  assert.equal(radios(html).length, 1, html);
  assert.match(html, /<input[^>]*type="radio"[^>]*aria-label="Claude Haiku 5\.5, in use"/);
  assert.match(html, /<input[^>]*value="claude-haiku-5-5"/);
  assert.match(html, /<input[^>]*checked=""/);
});

test("the visible in-use mark is set apart by a space", () => {
  assert.match(render(true), /Claude Haiku 5\.5 <span[^>]*>In use<\/span>/);
  assert.doesNotMatch(render(false), /In use/);
});

test("a model not in use is named by its label alone, and its details describe it", () => {
  const html = render(false);
  assert.equal(radios(html).length, 1);
  assert.match(html, /aria-label="Claude Haiku 5\.5"/);
  const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1];
  assert.ok(describedBy, html);
  for (const id of describedBy.split(" ")) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /about ₱0\.01 a question · ₱6\.20 per million tokens in, ₱31\.00 out/);
});
