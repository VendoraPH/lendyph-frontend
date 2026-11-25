/**
 * WHAT THIS PROVES: the Expenses list keeps its Actions column narrow and in
 * view: Pay is the row's one button, the rest sit in a named More menu, the
 * Actions heading and cells use the shared pinned classes, and the list
 * scrolls sideways in its own focusable, named region. Reverse expense,
 * disabled, carries its reason as the item's description.
 * WHAT IT DOES NOT PROVE: the rendered widths and scrolling (browser check).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = "src/app/(app)/accounting/expenses";
const read = (path: string) => readFileSync(resolve(process.cwd(), DIR, path), "utf8");

test("Pay stays on the row; the other actions sit in the More menu", () => {
  const table = read("_components/expense-table.tsx");
  assert.equal((table.match(/<Button\b/g) ?? []).length, 1);
  assert.match(table, /aria-label=\{`Pay \$\{expense\.payee\}`\}/);
  assert.match(table, /<ExpenseRowMenu\b/);
  for (const gone of ["JournalActionButton", ">Payments<", ">Edit<", ">Attachments<", "w-80"]) {
    assert.ok(!table.includes(gone), `${gone} is still on the row`);
  }
});

test("the Actions column is pinned with the shared classes", () => {
  const table = read("_components/expense-table.tsx");
  assert.match(table, /<TableHead className=\{cn\("text-right", STICKY_ACTIONS_HEAD\)\}>Actions<\/TableHead>/);
  assert.match(table, /<TableCell className=\{cn\("w-px text-right", STICKY_ACTIONS_CELL\)\}>/);
});

test("the list scrolls sideways in a focusable, named region", () => {
  const page = read("page.tsx");
  assert.match(page, /<ScrollBox className=\{VISIBLE_SCROLLBAR\} tabIndex=\{0\} role="region" aria-label="[^"]+">\s*<ExpenseTable/);
});

test("the More menu is named per row and says why Reverse expense waits", () => {
  const menu = read("_components/expense-row-menu.tsx");
  assert.match(menu, /<DropdownMenuTrigger[\s\S]*?aria-label=\{moreActionsLabel\(expense\.payee\)\}/);
  assert.match(menu, /<DropdownMenuItem disabled aria-describedby=\{reasonId\}>/);
  assert.match(menu, /<DropdownMenuLabel id=\{reasonId\}/);
  for (const item of ["Payments", "Edit", "Reverse expense", "Attachments"]) {
    assert.ok(menu.includes(item), `${item} is missing from the menu`);
  }
});
