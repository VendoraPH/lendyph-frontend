import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// An open sidebar menu animates to a max-height cap (CSS can't animate to
// `auto`), and anything taller is clipped with no scrollbar: Settings' last
// entry, Data Import, couldn't be reached once #650 gave Settings 20 entries.
// With every module switched on, the longest menu must fit the cap.

const FLAGS = [
  "AMLA",
  "ANALYTICS",
  "BINHS_AMORTIZATION",
  "CDA",
  "CREDIT_SCORING",
  "EXECUTIVE_DASHBOARD",
  "FEE_FORMULAS",
  "LINDA",
  "LOAN_ORIGINATION",
  "MEMBER_PORTAL",
  "MULTI_BRANCH",
  "PENALTY_CONFIGS",
  "SAVINGS",
];

/** One menu entry (about 34 px) plus the gap after it. */
const ENTRY_PX = 36;

interface Item {
  children?: Item[];
}

function entries(items: Item[]): number {
  return items.reduce((count, item) => count + 1 + entries(item.children ?? []), 0);
}

test("the longest sidebar menu fits the open menu's height cap", async () => {
  for (const flag of FLAGS) process.env[`NEXT_PUBLIC_ENABLE_${flag}`] = "true";
  const { SIDEBAR_NAV } = await import("./navigation");

  const longest = Math.max(...(SIDEBAR_NAV as Item[]).map((item) => entries(item.children ?? [])));
  const sidebar = readFileSync(join(process.cwd(), "src/components/layout/sidebar.tsx"), "utf8");
  const capRem = Number(/expanded \? "max-h-\[(\d+)rem\]/.exec(sidebar)?.[1]);

  assert.ok(capRem > 0, "the open menu's max-h cap wasn't found in sidebar.tsx");
  assert.ok(
    longest * ENTRY_PX <= capRem * 16,
    `the longest menu has ${longest} entries (${longest * ENTRY_PX}px), above the ${capRem * 16}px cap`,
  );
});
