/**
 * The new request form's field grid. It follows the dialog's own width (the
 * form is a container), not the window's: one column on a phone, two in a
 * mid-size dialog, three in the wide one. Long lines take `REQUEST_FIELD_FULL`.
 * The full width keeps every request type on one screen at 1366 x 768.
 */
export const REQUEST_FIELD_GRID = "grid gap-4 @lg:grid-cols-2 @3xl:grid-cols-3";

/** A line across the whole grid: a note, a checkbox, a form-wide message. */
export const REQUEST_FIELD_FULL = "col-span-full";
