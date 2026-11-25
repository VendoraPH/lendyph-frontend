/**
 * A savings entry paid by bank transfer, GCash or Maya needs the reference of
 * that payment (finish run round 5), as the server checks it
 * (`SavingsReference`): a deposit, a withdrawal, an opening deposit, a time
 * deposit placement, a Member Portal payout, and a payout at closing, at a
 * time deposit's maturity or on its pre-termination (`payout_reference`).
 * Cash needs none (a counter receipt; the server numbers a cash time
 * deposit), nor does `savings` (a placement paid from, or a payout into, the
 * member's own savings), nor an opening deposit of ₱0.00 or a full rollover.
 * The words are the server's, so the field reads the same before and after
 * sending. Dependency-free, so it runs under `tsx --test`.
 */

import type { SavingsMethod } from "@/types";

/** What the reference is for, as the server's message names it. */
export type SavingsReferenceEntry = "deposit" | "withdrawal" | "opening_deposit" | "time_deposit" | "payout";

const ENTRY_WORDS: Record<SavingsReferenceEntry, string> = {
  deposit: "this deposit",
  withdrawal: "this withdrawal",
  opening_deposit: "the opening deposit",
  time_deposit: "this time deposit",
  payout: "this payout",
};

/** The methods that need a reference, in the words the server's message uses. */
const METHOD_WORDS: Readonly<Record<string, string>> = {
  bank_transfer: "bank transfer",
  gcash: "GCash",
  maya: "Maya",
};

type MethodChoice = SavingsMethod | "" | null | undefined;

/** The method in the message's words when its reference is needed, else null. */
function neededMethodWords(method: MethodChoice, paid: boolean): string | null {
  return paid && typeof method === "string" && Object.hasOwn(METHOD_WORDS, method) ? METHOD_WORDS[method] : null;
}

/** Whether money moved by `method` needs its reference; `paid` false (nothing deposited) needs none. */
export function referenceNeeded(method: MethodChoice, paid = true): boolean {
  return neededMethodWords(method, paid) !== null;
}

/** The field's label: "(optional)" only where a blank reference is accepted. */
export function referenceLabel(needed: boolean): string {
  return needed ? "Reference" : "Reference (optional)";
}

/** Why the reference can't be left blank, in the server's words, or null. */
export function savingsReferenceError(
  method: MethodChoice,
  reference: string,
  entry: SavingsReferenceEntry,
  paid = true,
): string | null {
  const words = neededMethodWords(method, paid);
  if (words === null || reference.trim() !== "") return null;
  return `Enter the ${words} reference for ${ENTRY_WORDS[entry]}.`;
}

/** A payout's `payout_reference` as sent: the typed reference, or nothing when blank or paid into savings. */
export function payoutReferenceField(method: MethodChoice, reference: string): { payout_reference?: string } {
  const typed = reference.trim();
  return method === "savings" || typed === "" ? {} : { payout_reference: typed };
}
