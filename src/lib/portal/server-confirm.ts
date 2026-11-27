import type { Confirmed } from "./portal-client";

/**
 * "Never show success before the server confirms" (portal TASK 74).
 *
 * A member's write is shown as done only once the server has answered with
 * the status that means it: 201 for a new request, 202 when it waits for a
 * second check, 200 for the rest. Anything else (a 204, or a 200 where a 201
 * was due) is not proof, so the screen says it couldn't confirm instead of
 * saying it worked.
 */
export class NotConfirmedError extends Error {
  constructor(public readonly status: number) {
    super("We couldn't confirm that this went through. Check the list before trying again.");
    this.name = "NotConfirmedError";
  }
}

/** The statuses each kind of write must answer with. */
export const CONFIRMS = {
  created: [201],
  createdOrQueued: [201, 202],
  done: [200],
} as const;

export function confirmed<T>(result: Confirmed<T>, expected: readonly number[]): T {
  if (!expected.includes(result.status)) throw new NotConfirmedError(result.status);
  return result.data;
}

/**
 * Runs a write and calls `onConfirmed` only after the server's answer is in
 * and carries an expected status; `onFailed` hears everything else. Returns
 * the settled promise so a caller (and a test) can wait for it.
 */
export function whenConfirmed<T>(
  write: Promise<Confirmed<T>> | null,
  expected: readonly number[],
  onConfirmed: (data: T, status: number) => void,
  onFailed: (err: unknown) => void,
): Promise<void> {
  if (write === null) return Promise.resolve();
  return write.then(
    (result) => {
      let data: T;
      try {
        data = confirmed(result, expected);
      } catch (err) {
        onFailed(err);
        return;
      }
      onConfirmed(data, result.status);
    },
    (err: unknown) => onFailed(err),
  );
}
