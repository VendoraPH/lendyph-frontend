import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OptionSelect } from "./option-select";

// A wrapping field still reads one line at the shared 32 px (h-8): the 20 px
// line plus 5 px top and bottom plus the 1 px borders. `py-1.5` made it 34 px.
function triggerClasses(wrap: boolean): string[] {
  const markup = renderToStaticMarkup(
    h(OptionSelect, {
      id: "at-maturity",
      value: "rollover",
      onChange: () => {},
      options: [{ value: "rollover", label: "Roll over principal, pay out interest" }],
      wrap,
    }),
  );
  const tag = markup.match(/<[^>]*data-slot="select-trigger"[^>]*>/)?.[0] ?? "";
  return (tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
}

test("a wrapping option field keeps one line at 32 px and grows for more", () => {
  const classes = triggerClasses(true);
  assert.ok(classes.includes("py-[5px]"), classes.join(" "));
  assert.ok(!classes.includes("py-1.5"), classes.join(" "));
  assert.ok(classes.includes("min-h-8"), classes.join(" "));
  assert.ok(classes.includes("data-[size=default]:h-auto"), classes.join(" "));
});

test("a field that doesn't wrap is the shared select unchanged", () => {
  const classes = triggerClasses(false);
  assert.ok(!classes.includes("py-[5px]"), classes.join(" "));
  assert.ok(!classes.includes("min-h-8"), classes.join(" "));
});
