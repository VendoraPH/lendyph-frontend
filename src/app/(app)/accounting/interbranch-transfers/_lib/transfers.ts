/**
 * Interbranch transfers (Phase 6 MB-BE5). The server decides every step: the
 * maker never approves, the receiver is neither the maker nor the approver,
 * and only a transfer in transit can be reversed. The screen offers exactly
 * what `actions` allows and sends the server's body; it adds up nothing.
 */

import { fromCentavos, toCentavos } from "@/lib/accounting/money";
import { getErrorMessage, validationErrors } from "@/lib/api-error";
import { branchStatusOf, type BranchStatusFields } from "@/lib/branch-status";
import type {
  InterbranchTransfer,
  InterbranchTransferActions,
  InterbranchTransferInput,
  InterbranchTransferStatus,
} from "@/types/interbranch-transfer";

export type TransferActionKind = "approve" | "receive" | "reject" | "cancel" | "reverse";

/** The server's limits on a rejection note and a reversal reason. */
export const NOTE_LIMITS = { note: 500, reason: 300 } as const;

export const PURPOSE_MAX = 500;
export const REFERENCE_MAX = 64;

export interface TransferActionButton {
  kind: TransferActionKind;
  label: string;
  /** Posts a journal, so it sends an Idempotency-Key. */
  posts: boolean;
  /** The words the step asks for, or null when it asks for none. */
  text: { field: "note" | "reason"; label: string; max: number } | null;
  /** What the confirm dialog says. */
  confirm: string;
}

const BUTTONS: { flag: keyof InterbranchTransferActions; button: TransferActionButton }[] = [
  {
    flag: "can_approve",
    button: {
      kind: "approve",
      label: "Approve and send",
      posts: true,
      text: null,
      confirm: "The money leaves the source account now and is held in Interbranch Clearing until the destination branch receives it.",
    },
  },
  {
    flag: "can_receive",
    button: {
      kind: "receive",
      label: "Receive",
      posts: true,
      text: null,
      confirm: "Confirm the money has arrived. It moves from Interbranch Clearing into the destination account.",
    },
  },
  {
    flag: "can_reject",
    button: {
      kind: "reject",
      label: "Reject",
      posts: false,
      text: { field: "note", label: "Why it's rejected", max: NOTE_LIMITS.note },
      confirm: "Nothing was posted, so nothing moves. The maker sees your note.",
    },
  },
  {
    flag: "can_cancel",
    button: {
      kind: "cancel",
      label: "Cancel",
      posts: false,
      text: null,
      confirm: "Nothing was posted, so nothing moves. The transfer is closed.",
    },
  },
  {
    flag: "can_reverse",
    button: {
      kind: "reverse",
      label: "Reverse",
      posts: true,
      text: { field: "reason", label: "Why it's reversed", max: NOTE_LIMITS.reason },
      confirm: "The money goes back to the source account, dated today, with a linked reversal of the dispatch entry.",
    },
  },
];

/** The steps the caller may take, from the server's `actions` only. */
export function transferActionButtons(actions: InterbranchTransferActions | null | undefined): TransferActionButton[] {
  if (!actions) return [];
  return BUTTONS.filter(({ flag }) => actions[flag] === true).map(({ button }) => button);
}

const STATUS_WORDS: Record<InterbranchTransferStatus, string> = {
  pending_approval: "Pending approval",
  in_transit: "In transit",
  received: "Received",
  rejected: "Rejected",
  cancelled: "Cancelled",
  reversed: "Reversed",
};

/** The server's label, else the status in words. */
export function transferStatusLabel(transfer: Pick<InterbranchTransfer, "status" | "status_label">): string {
  return transfer.status_label?.trim() || STATUS_WORDS[transfer.status] || "Unknown";
}

/** The create form, as typed. */
export interface TransferForm {
  sourceBranchId: number | null;
  destinationBranchId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  /** In pesos, as typed. */
  amount: string;
  purpose: string;
  reference: string;
}

export const EMPTY_TRANSFER_FORM: TransferForm = {
  sourceBranchId: null,
  destinationBranchId: null,
  fromAccountId: null,
  toAccountId: null,
  amount: "",
  purpose: "",
  reference: "",
};

/**
 * A received transfer goes back as a new transfer the other way (it can't be
 * reversed). Offered to someone who can make transfers; the server still
 * checks they can see the new source branch.
 */
export function canSendBack(transfer: InterbranchTransfer, canCreate: boolean): boolean {
  return (
    canCreate &&
    transfer.status === "received" &&
    transfer.source_branch !== null &&
    transfer.destination_branch !== null &&
    transfer.from_account !== null &&
    transfer.to_account !== null
  );
}

/** The new transfer's form: branches and accounts swapped, the same amount, naming the original. */
export function sendBackForm(transfer: InterbranchTransfer): TransferForm {
  const purpose = `Sending back ${transfer.transfer_number}: ${transfer.purpose}`;
  return {
    sourceBranchId: transfer.destination_branch?.id ?? null,
    destinationBranchId: transfer.source_branch?.id ?? null,
    fromAccountId: transfer.to_account?.id ?? null,
    toAccountId: transfer.from_account?.id ?? null,
    amount: fromCentavos(transfer.amount).toFixed(2),
    purpose: purpose.length > PURPOSE_MAX ? `${purpose.slice(0, PURPOSE_MAX - 1)}…` : purpose,
    reference: transfer.transfer_number.slice(0, REFERENCE_MAX),
  };
}

export type TransferFormErrors = Partial<Record<keyof TransferForm, string>>;

export type TransferInputResult =
  | { ok: true; input: InterbranchTransferInput }
  | { ok: false; errors: TransferFormErrors };

const TWO_DECIMALS = /^\d+(\.\d{1,2})?$/;

/** The server's body, or each problem in words, field by field. */
export function buildTransferInput(form: TransferForm): TransferInputResult {
  const errors: TransferFormErrors = {};
  const purpose = form.purpose.trim();
  const reference = form.reference.trim();
  const typed = form.amount.replace(/[₱,\s]/g, "");
  const amount = toCentavos(form.amount);

  if (form.sourceBranchId === null) errors.sourceBranchId = "Choose the branch the money leaves from.";
  if (form.destinationBranchId === null) errors.destinationBranchId = "Choose the branch the money goes to.";
  else if (form.destinationBranchId === form.sourceBranchId)
    errors.destinationBranchId = "The money has to go to a different branch.";
  if (form.fromAccountId === null) errors.fromAccountId = "Choose the account the money leaves from.";
  if (form.toAccountId === null) errors.toAccountId = "Choose the account the money arrives in.";
  if (typed !== "" && !TWO_DECIMALS.test(typed)) errors.amount = "Enter the amount in pesos, with at most two decimals.";
  else if (amount === null || amount <= 0) errors.amount = "Enter an amount above ₱0.00.";
  if (purpose === "") errors.purpose = "Say what the transfer is for.";
  else if (purpose.length > PURPOSE_MAX) errors.purpose = `The purpose can be at most ${PURPOSE_MAX} characters.`;
  if (reference.length > REFERENCE_MAX) errors.reference = `The reference can be at most ${REFERENCE_MAX} characters.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const input: InterbranchTransferInput = {
    source_branch_id: form.sourceBranchId!,
    destination_branch_id: form.destinationBranchId!,
    from_account_id: form.fromAccountId!,
    to_account_id: form.toAccountId!,
    amount: amount!,
    purpose,
  };
  if (reference) input.reference = reference;
  return { ok: true, input };
}

/** The server's field keys, as the form names them. */
const SERVER_FIELDS: Record<string, keyof TransferForm> = {
  source_branch_id: "sourceBranchId",
  destination_branch_id: "destinationBranchId",
  from_account_id: "fromAccountId",
  to_account_id: "toAccountId",
  amount: "amount",
  purpose: "purpose",
  reference: "reference",
};

const FAILED = "We couldn't save this transfer. Please try again.";

/**
 * Where a refusal shows, in the server's words: a refused form field beside
 * that field; anything else (the step itself, a closed branch, the maker
 * approving, a 409) above the buttons.
 */
export function transferFailure(err: unknown): { fields: TransferFormErrors; general: string | null } {
  const errors = validationErrors(err);
  const fields: TransferFormErrors = {};
  const other: string[] = [];
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const field = SERVER_FIELDS[key];
    if (!messages[0]) continue;
    if (field) fields[field] = messages[0];
    else other.push(messages[0]);
  }
  if (errors && other.length === 0 && Object.keys(fields).length > 0) return { fields, general: null };
  return { fields, general: other[0] ?? getErrorMessage(err, FAILED) };
}

/** A branch a transfer can use, labelled for the picker: "North (NTH) · Suspended". */
export interface TransferBranchOption {
  id: number;
  name: string;
  code?: string | null;
  label: string;
}

type ListedBranch = { id: number; name: string; code?: string | null } & BranchStatusFields;

/**
 * The branches a transfer can use (MB-BE5): a closed branch refuses transfers,
 * a suspended one allows them (to empty its cash before closing, say) and is
 * marked "· Suspended". The source is one of the caller's branches (every
 * listed one with See all branches); the destination may be any branch that
 * isn't closed. The server checks both again.
 */
export function transferBranchOptions(
  listed: readonly ListedBranch[],
  caller: { viewAll: boolean; own: readonly { id: number; name: string; code?: string | null }[] },
): { sources: TransferBranchOption[]; destinations: TransferBranchOption[] } {
  const byId = new Map(listed.map((b) => [b.id, b]));
  const option = (b: { id: number; name: string; code?: string | null }): TransferBranchOption | null => {
    const known = byId.get(b.id);
    const status = known ? branchStatusOf(known) : "active";
    if (status === "closed") return null;
    const named = b.code ? `${b.name} (${b.code})` : b.name;
    return { id: b.id, name: b.name, code: b.code, label: status === "suspended" ? `${named} · Suspended` : named };
  };
  const keep = (rows: readonly { id: number; name: string; code?: string | null }[]) =>
    rows.map(option).filter((o): o is TransferBranchOption => o !== null);
  const ownIds = new Set(caller.own.map((b) => b.id));
  const sourceRows = caller.viewAll
    ? listed
    : [...listed.filter((b) => ownIds.has(b.id)), ...caller.own.filter((b) => !byId.has(b.id))];
  return { sources: keep(sourceRows), destinations: keep(listed) };
}

export type TransferStep = "create" | TransferActionKind;

/**
 * What a successful step reloads. Every step can change the list, what is in
 * transit and the branch counts (waiting for approval, in transit), so all
 * three reload.
 */
export function stepRefreshes(step: TransferStep): { list: boolean; inTransit: boolean; counts: boolean } {
  void step;
  return { list: true, inTransit: true, counts: true };
}
