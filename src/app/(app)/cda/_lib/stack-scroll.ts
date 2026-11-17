/**
 * The CDA StackScroll's classes, on top of the scroll box's own (ScrollBox
 * merges them with tailwind-merge): cards stack as a block; below fit
 * `overflow-x-visible` replaces the box's sideways scroll, so the page scrolls
 * exactly as before; at fit a 4px inset keeps the cards' outlines and the
 * fields' focus rings clear of the box's edge without moving anything.
 */
export const STACK_SCROLL_CLASSES = "space-y-6 overflow-x-visible fit:-m-1 fit:p-1";
