// Where focus goes when a dialog closes. Base UI returns it to the element
// that opened the dialog, which is right unless the action removed that
// element (Make main office, Ask to close): then focus fell to the page body.

/**
 * `true` keeps the dialog's default (back to the opener). After a success,
 * the caller's fallback, while it is still on the page, takes focus instead.
 */
export function dialogFinalFocus({
  succeeded,
  fallback,
}: {
  succeeded: boolean;
  fallback: HTMLElement | null;
}): HTMLElement | true {
  return succeeded && fallback?.isConnected ? fallback : true;
}
