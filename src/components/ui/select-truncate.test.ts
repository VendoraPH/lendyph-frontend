import { test } from "node:test"
import assert from "node:assert/strict"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Select, SelectTrigger, SelectValue } from "./select"

// A long value used to be cut with no "…" ("Stepper test savings (ST"): the
// trigger made the value a flex box, and text-overflow doesn't apply to one.
function triggerMarkup(): string {
  return renderToStaticMarkup(
    h(
      Select,
      { value: "a", items: [{ value: "a", label: "Stepper test savings (ST-0001)" }] },
      h(SelectTrigger, { className: "w-40" }, h(SelectValue)),
    ),
  )
}

function classesOf(markup: string, slot: string): string[] {
  const tag = markup.match(new RegExp(`<[^>]*data-slot="${slot}"[^>]*>`))?.[0] ?? ""
  return (tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/)
}

test("a long select value is truncated with an ellipsis", () => {
  const value = classesOf(triggerMarkup(), "select-value")
  assert.ok(value.includes("truncate"), value.join(" "))
  assert.ok(value.includes("min-w-0"), value.join(" "))
})

test("the trigger doesn't turn its value into a flex box", () => {
  const trigger = classesOf(triggerMarkup(), "select-trigger")
  assert.ok(!trigger.includes("*:data-[slot=select-value]:flex"), trigger.join(" "))
})
