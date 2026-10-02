/**
 * Tab order for a focus trap, as pure logic. The DOM side reads each
 * candidate element into a `FocusCandidate`; these rules decide the rest.
 */

/** What decides whether an element can take focus from Tab. */
export interface FocusCandidate {
  /** The element's `tabIndex`; below 0 means "focusable, but not by Tab". */
  tabIndex: number;
  /** `:disabled` or `aria-disabled="true"`, whatever its tabindex says. */
  disabled: boolean;
  /** Not rendered, `hidden`, or inside an inert subtree. */
  hidden: boolean;
}

export function isTabbable(c: FocusCandidate): boolean {
  return c.tabIndex >= 0 && !c.disabled && !c.hidden;
}

/**
 * The index Tab (or Shift+Tab, `backwards`) should focus among `count`
 * tabbables, wrapping at both ends. `current` is the focused one's index, or
 * -1 when focus is elsewhere in the container (e.g. the container itself).
 * -1 back means there is nothing to focus.
 */
export function nextTabIndex(count: number, current: number, backwards: boolean): number {
  if (count === 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return (current + (backwards ? count - 1 : 1)) % count;
}
