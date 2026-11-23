import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// An open sidebar menu animates to a max-height cap (CSS can't animate to
// `auto`), and anything taller is clipped with no scrollbar: Settings' last
// entry, Data Import, couldn't be reached once #650 gave Settings 20 entries.
// With every module switched on, the longest menu must fit the cap.

const FLAGS = [
  "NEXT_PUBLIC_ENABLE_AMLA",
  "NEXT_PUBLIC_ENABLE_ANALYTICS",
  "NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION",
  "NEXT_PUBLIC_ENABLE_CDA",
  "NEXT_PUBLIC_ENABLE_CREDIT_SCORING",
  "NEXT_PUBLIC_ENABLE_EXECUTIVE_DASHBOARD",
  "NEXT_PUBLIC_ENABLE_FEE_FORMULAS",
  "NEXT_PUBLIC_ENABLE_LINDA",
  "NEXT_PUBLIC_ENABLE_LOAN_ORIGINATION",
  "NEXT_PUBLIC_ENABLE_MEMBER_PORTAL",
  "NEXT_PUBLIC_ENABLE_MULTI_BRANCH",
  "NEXT_PUBLIC_ENABLE_PENALTY_CONFIGS",
  "NEXT_PUBLIC_ENABLE_SAVINGS",
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
  for (const flag of FLAGS) process.env[flag] = "true";
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
