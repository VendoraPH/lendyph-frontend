import { test } from "node:test"
import assert from "node:assert/strict"
import { twMerge } from "tailwind-merge"

import { dialogSizeClass } from "./dialog-size"

test("a dialog that passes no width keeps its size's default", () => {
  assert.equal(dialogSizeClass("default", undefined), "sm:max-w-md")
  assert.equal(dialogSizeClass("sm", "max-h-[90vh]"), "sm:max-w-sm")
  assert.equal(dialogSizeClass("xl", "max-h-[90vh] overflow-y-auto"), "sm:max-w-4xl")
})

test("a passed unprefixed max-w replaces the default at every breakpoint", () => {
  // tailwind-merge keeps `sm:max-w-md` beside `max-w-2xl` (different variants),
  // so the dialog showed at 448 px on desktop.
  assert.equal(dialogSizeClass("default", "max-w-2xl"), "")
  assert.equal(dialogSizeClass("default", "max-h-[90vh] max-w-3xl overflow-y-auto"), "")
  const merged = twMerge("max-w-[calc(100%-2rem)]", dialogSizeClass("default", "max-w-lg"), "max-w-lg")
  assert.equal(merged, "max-w-lg")
})

test("a passed breakpoint width still merges with the default as before", () => {
  assert.equal(dialogSizeClass("default", "sm:max-w-3xl"), "sm:max-w-md")
  assert.equal(dialogSizeClass("default", "w-[95vw] sm:w-full sm:max-w-3xl"), "sm:max-w-md")
})

test("full size is never changed by a passed class", () => {
  assert.equal(
    dialogSizeClass("full", "max-w-2xl"),
    "sm:max-w-[calc(100vw-4rem)] sm:max-h-[calc(100vh-4rem)] h-full",
  )
})
