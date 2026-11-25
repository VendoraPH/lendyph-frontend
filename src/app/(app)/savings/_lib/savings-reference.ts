/**
 * Money coming in by bank transfer, GCash or Maya needs the reference of that
 * payment (finish run round 5), as the server checks it (`SavingsReference`):
 * a deposit, an opening deposit (staff's, or a member's new account) and a
 * time deposit placement. That reference exists before the money is
 * recorded. Money going out (a withdrawal, a Member Portal payout, a payout
 * at closing, maturity or pre-termination) doesn't need one: its reference
 * exists only once the money is sent, which is after any approval, so it
 * stays optional, and the server still checks one given for duplicates.
 * Cash needs none (a counter receipt; the server numbers a cash time
 * deposit), nor does `savings` (a placement paid from the member's own
 * savings), nor an opening deposit of ₱0.00. The words are the server's, so
 * the field reads the same before and after sending. Dependency-free, so it
 * runs under `tsx --test`.
 */

import type { SavingsMethod } from "@/types";

/** The money coming in that the reference is for, as the server's message names it. */
export type SavingsReferenceEntry = "deposit" | "opening_deposit" | "time_deposit";

const ENTRY_WORDS: Record<SavingsReferenceEntry, string> = {
  deposit: "this deposit",
  opening_deposit: "the opening deposit",
  time_deposit: "this time deposit",
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

/**
 * The counter's rule (Deposit and Withdrawal share a dialog): a deposit by
 * bank transfer, GCash or Maya needs its reference; a withdrawal never does.
 */
export function counterReferenceRule(
  mode: "deposit" | "withdrawal",
  method: MethodChoice,
  reference: string,
): { needed: boolean; problem: string | null } {
  if (mode === "withdrawal") return { needed: false, problem: null };
  return { needed: referenceNeeded(method), problem: savingsReferenceError(method, reference, "deposit") };
}

/** A payout's optional `payout_reference` as sent: the typed reference, or nothing when blank or paid into savings. */
export function payoutReferenceField(method: MethodChoice, reference: string): { payout_reference?: string } {
  const typed = reference.trim();
  return method === "savings" || typed === "" ? {} : { payout_reference: typed };
}
