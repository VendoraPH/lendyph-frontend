import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Base UI's menu label needs a surrounding group, and throws when the menu
 * opens without one, which took the Export CSV menu down. Rendering it needs a
 * DOM, which these tests don't have, so this reads the component's source.
 */
test("the Export CSV menu's label sits inside a group", () => {
  const source = readFileSync(join(import.meta.dirname, "export-actions.tsx"), "utf8");
  const label = source.indexOf("<DropdownMenuLabel");
  assert.ok(label > -1);
  assert.ok(source.lastIndexOf("<DropdownMenuGroup", label) > -1, "no group opens before the label");
  assert.ok(source.indexOf("</DropdownMenuGroup>", label) > -1, "no group closes after the label");
});
