// A sign-off refused because a step the loan's chain left out now applies
// (Phase 6 MB-BE6): the principal was raised past that step's minimum after
// the loan was submitted. The server answers 422 on `approval`, in words that
// name the step and its minimum and say to send the loan back to the Submit
// step, which sets the chain again. The card keeps that sentence beside the
// step's actions, as it is, until the step changes.

import { validationErrors } from "@/lib/api-error";

/** The server's sentence for a refused sign-off, or null for any other answer. */
export function signOffRefusal(err: unknown): string | null {
  const first = validationErrors(err)?.approval?.[0];
  return first ? first : null;
}

/** A refusal, kept with the step it was made on (the step row's id). */
export interface KeptRefusal {
  key: string;
  message: string;
}

/** The refusal to show on the step on screen: only the step it was made on shows it. */
export function signOffRefusalFor(kept: KeptRefusal | null, key: string): string | null {
  return kept?.key === key ? kept.message : null;
}
