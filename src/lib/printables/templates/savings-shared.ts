/**
 * Helpers shared by the savings documents in the catalog (opening form,
 * agreement, closure form, dormancy notice, withdrawal slip, and the two time
 * deposit documents). Not a template itself.
 *
 * Every figure is the server's, printed as sent. The member's personal data
 * (birthdate, address, contact details) is read only from the member record
 * the server answers to a caller with `borrowers:view` in the member's branch
 * (the round fz rule); without it those lines are left blank to fill in.
 */

import { formatRate } from "@/lib/format";
import { ACCOUNT_STATUS_LABELS, labelOf } from "@/app/(app)/savings/_lib/savings-rules";
import type { PrintField } from "../types";
import { asRecord, dateField, field, pick } from "./shared";

export type Payload = Record<string, unknown> | null;

/** A part of the catalog's composite payload (`{account, member, …}`), or null. */
export function part(raw: unknown, key: string): Payload {
  return asRecord(pick(asRecord(raw), [key]));
}

/** A text value, or null when the server sent none. */
export function str(source: Payload, key: string): string | null {
  const value = pick(source, [key]);
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/** A product's name from the account (`product.name`) or a report row (`product_name`). */
export function productName(source: Payload): string | null {
  return str(asRecord(pick(source, ["product"])), "name") ?? str(source, "product_name");
}

/** "4.25% per annum", the rate as stored (never rounded), or null. */
export function ratePerAnnum(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `${formatRate(value as string)}% per annum`;
}

/** The account status in words. */
export function accountStatus(account: Payload): string {
  return labelOf(ACCOUNT_STATUS_LABELS, str(account, "status"));
}

/** The account block every account document opens with. */
export function accountFields(account: Payload): PrintField[] {
  return [
    field("Account No.", str(account, "account_number")),
    field("Depositor", str(account, "borrower_name")),
    field("Member No.", str(account, "borrower_code")),
    field("Product", productName(account)),
    field("Branch", str(account, "branch_name")),
    dateField("Date opened", str(account, "opened_on")),
  ];
}

/**
 * The depositor's own details, from the member record when the server sent
 * it, else lines to fill in by hand.
 */
export function depositorFields(account: Payload, member: Payload): PrintField[] {
  return [
    field("Name", str(member, "full_name") ?? str(account, "borrower_name")),
    field("Member No.", str(member, "borrower_code") ?? str(account, "borrower_code")),
    dateField("Birthdate", str(member, "birthdate")),
    field("Contact number", str(member, "contact_number")),
    field("Email", str(member, "email")),
    field("Address", str(member, "address")),
  ];
}
