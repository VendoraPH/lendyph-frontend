import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { CommandDialog, CommandInput } from "./command"
import { DialogContent } from "./dialog"

/** The DialogContent element CommandDialog renders, found in its element tree. */
function dialogContentOf(node: ReactNode): ReactElement<{ children?: ReactNode }> | null {
  if (!isValidElement<{ children?: ReactNode }>(node)) return null
  if (node.type === DialogContent) return node
  const children = ([] as ReactNode[]).concat(node.props.children ?? [])
  for (const child of children) {
    const found = dialogContentOf(child)
    if (found) return found
  }
  return null
}

describe("CommandDialog", () => {
  // The header's Cmd+K palette puts a CommandInput and a CommandList straight
  // into CommandDialog. cmdk's input and list need its root (<Command>) above
  // them; without it, opening the palette threw "Cannot read properties of
  // undefined (reading 'subscribe')" and took the whole app down.
  it("wraps what it shows in the cmdk root, so its input renders", () => {
    const tree = CommandDialog({
      open: true,
      children: createElement(CommandInput, { placeholder: "Type a command or search..." }),
    })

    const content = dialogContentOf(tree)
    assert.ok(content, "CommandDialog renders a DialogContent")

    const html = renderToStaticMarkup(createElement("div", null, content.props.children))
    assert.match(html, /data-slot="command"/)
    assert.match(html, /placeholder="Type a command or search\.\.\."/)
  })
})
