/**
 * The code dialog's attempts. A code is shown once, so the dialog can't be
 * closed while one is being issued, and a code that arrives for an attempt
 * the dialog has since given up on (closed, or a newer attempt) is dropped
 * rather than shown in a dialog nobody is looking at.
 */
export interface CodeAttempts {
  /** Start an attempt; returns its id. */
  begin(): number;
  /** The dialog closed or reset: no attempt in flight may show its code. */
  cancel(): void;
  /** Whether a code for this attempt may still be shown. */
  isCurrent(id: number): boolean;
}

export function createCodeAttempts(): CodeAttempts {
  let latest = 0;
  let live = 0;
  return {
    begin: () => {
      latest = latest + 1;
      live = latest;
      return live;
    },
    cancel: () => {
      live = 0;
    },
    isCurrent: (id) => id !== 0 && id === live,
  };
}

/** Opening is always allowed; closing waits for the server while a code is being issued. */
export function closeAllowed(next: boolean, submitting: boolean): boolean {
  return next || !submitting;
}
