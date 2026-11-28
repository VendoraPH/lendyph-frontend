// The override's CIC contract number: the number CIC reads a loan by when its
// own Loan No. is over 38 characters or collides with another. The server
// checks its form (letters, digits and dashes, not the reserved "loan-" form),
// its uniqueness, and refuses a change once a submitted file carries it. Pure,
// so what is sent is unit-tested.

/** CIC's limit for a contract number. */
export const CONTRACT_NO_MAX = 38;

/** What the save sends for the contract number: nothing (keep it), a number, or null (clear it). */
export type ContractNoChange = Record<string, never> | { contract_no: string } | { contract_no: null };

/**
 * `stored`: the override's number (null when adding, or when it has none).
 * `locked`: a submitted file carries it (`contract_no_reported`), so it is
 * never sent. On a new override a blank field sends nothing; on an edit an
 * unchanged field sends nothing (the server keeps it), and emptying a stored
 * number sends null.
 */
export function contractNoChange(stored: string | null, typed: string, { editing, locked }: { editing: boolean; locked: boolean }): ContractNoChange {
  if (locked) return {};
  const value = typed.trim();
  if (!editing) return value === "" ? {} : { contract_no: value };
  if (value === (stored ?? "")) return {};
  return value === "" ? { contract_no: null } : { contract_no: value };
}

/** Why an override can't be removed, or null when it can: a submitted file carries its number. */
export function overrideRemoveBlockedReason(override: { contract_no_reported: boolean }): string | null {
  return override.contract_no_reported ? "A file submitted to CIC carries this number, so the override stays." : null;
}
