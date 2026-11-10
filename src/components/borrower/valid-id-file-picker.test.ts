import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ValidIdFilePicker } from "./valid-id-file-picker";

test("the ID picker is a real button that Tab reaches, named for its side and row, with a visible focus ring", () => {
  const html = renderToStaticMarkup(
    createElement(ValidIdFilePicker, {
      controlId: "valid_id_front_1",
      side: "front",
      rowName: "Passport (ID 2)",
      onPick: () => {},
    }),
  );
  const button = html.match(/<button[^>]*>/)?.[0] ?? "";
  assert.match(button, /type="button"/);
  assert.match(button, /id="valid_id_front_1"/);
  assert.match(button, /aria-label="Upload front of Passport \(ID 2\)"/);
  assert.match(button, /focus-visible:ring/);
  assert.doesNotMatch(button, /tabindex|disabled/i);
  // The file input is hidden and not wrapped in a <label>; the button opens it.
  const input = html.match(/<input[^>]*>/)?.[0] ?? "";
  assert.match(input, /type="file"/);
  assert.match(input, /class="hidden"/);
  assert.match(input, /accept="image\/\*,\.pdf"/);
  assert.doesNotMatch(html, /<label/);
});

const pages = {
  "new member page": readFileSync(join(process.cwd(), "src/app/(app)/borrowers/new/page.tsx"), "utf8"),
  "edit member page": readFileSync(join(process.cwd(), "src/app/(app)/borrowers/[id]/edit/page.tsx"), "utf8"),
};

for (const [name, source] of Object.entries(pages)) {
  test(`the ${name}'s ID rows: keyboard pickers, linked side labels, and named buttons`, () => {
    for (const side of ["front", "back"]) {
      const id = "`valid_id_" + side + "_${index}`";
      assert.ok(source.includes(`controlId={${id}}`), `${name}: ${side} picker`);
      assert.ok(source.includes(`htmlFor={entry.${side}_preview ? undefined : ${id}}`), `${name}: ${side} label`);
      assert.ok(source.includes(`aria-label={\`Remove ${side} of \${validIdRowName(entry, index)}\`}`), `${name}: remove ${side}`);
      assert.ok(source.includes(`aria-label={\`Crop ${side} of \${validIdRowName(entry, index)}\`}`), `${name}: crop ${side}`);
    }
    assert.ok(!source.includes("Upload Front</span>"), `${name}: no label-wrapped picker left`);
    assert.ok(source.includes("aria-label={removeValidIdRowLabel(entry, index)}"), `${name}: remove row`);
  });
}
