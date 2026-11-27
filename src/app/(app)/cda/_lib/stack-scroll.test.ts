/**
 * The class list behind the CDA StackScroll.
 *
 * WHAT THIS PROVES: merged with the scroll box's own classes (tailwind-merge,
 * as ScrollBox does), the stack never scrolls sideways below fit
 * (`overflow-x-visible` replaces `overflow-x-auto`), still scrolls inside at
 * fit, keeps its 4px inset only at fit, and stacks its cards as a block.
 * WHAT IT DOES NOT PROVE: the rendered layout (browser check at each size).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scrollBoxClass } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { STACK_SCROLL_CLASSES } from "./stack-scroll";

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);
const merged = (extra?: string) => tokens(cn(scrollBoxClass(), STACK_SCROLL_CLASSES, extra));

test("below fit the stack doesn't scroll sideways: overflow-x-visible wins over the scroll box's overflow-x-auto", () => {
  const c = merged();
  assert.ok(c.includes("overflow-x-visible"), c.join(" "));
  assert.ok(!c.includes("overflow-x-auto"), c.join(" "));
});

test("at fit the stack still takes the height left and scrolls inside", () => {
  const c = merged();
  for (const t of ["fit:flex-1", "fit:min-h-0", "fit:overflow-auto"]) assert.ok(c.includes(t), t);
});

test("the inset that keeps outlines and focus rings clear applies only at fit", () => {
  const c = merged();
  for (const t of ["fit:-m-1", "fit:p-1"]) assert.ok(c.includes(t), t);
  assert.ok(!c.some((t) => /^-?(m|p)-/.test(t)), c.join(" "));
});

test("cards stack as a block with space-y, never as a flex column that would shrink them", () => {
  const c = merged();
  assert.ok(c.includes("space-y-6"), c.join(" "));
  assert.ok(!c.includes("flex") && !c.includes("flex-col"), c.join(" "));
});

test("a page's own spacing replaces the default one", () => {
  const c = merged("space-y-4");
  assert.ok(c.includes("space-y-4") && !c.includes("space-y-6"), c.join(" "));
});
