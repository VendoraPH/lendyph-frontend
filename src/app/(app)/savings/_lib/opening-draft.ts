import { formatCurrency, formatDate } from "@/lib/format";
import type {
  SavingsMemberType,
  SavingsProduct,
  SavingsOpeningCheck,
  SavingsOpeningDetailsInput,
  SavingsSourceOfFunds,
  StaffMember,
} from "@/types";
import { labelOf } from "./savings-rules";

/**
 * The opening details on Open a savings account (account officer, source of
 * funds, beneficiary) and the member check panel's words. Every figure in the
 * check is the server's (`GET /savings/opening-check`); a figure it didn't
 * send reads "—", never ₱0.00.
 */

export const SOURCE_OF_FUNDS_LABELS: Record<SavingsSourceOfFunds, string> = {
  salary: "Salary",
  business: "Business",
  remittance: "Remittance",
  pension: "Pension",
  savings: "Savings",
  other: "Other",
};

export const SOURCE_OF_FUNDS_OPTIONS: ReadonlyArray<{ value: SavingsSourceOfFunds; label: string }> = (
  Object.keys(SOURCE_OF_FUNDS_LABELS) as SavingsSourceOfFunds[]
).map((value) => ({ value, label: SOURCE_OF_FUNDS_LABELS[value] }));

export const MEMBER_TYPE_LABELS: Record<SavingsMemberType, string> = {
  regular: "Regular member",
  associate: "Associate member",
};

const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
  rejected: "Rejected",
  blacklisted: "Blacklisted",
  withdrawn: "Withdrawn",
  deceased: "Deceased",
};

export interface OpeningDetailsDraft {
  officer: StaffMember | null;
  source: SavingsSourceOfFunds | "";
  sourceOther: string;
  beneficiaryName: string;
  beneficiaryRelationship: string;
  beneficiaryContact: string;
}

export const EMPTY_OPENING_DETAILS: OpeningDetailsDraft = {
  officer: null,
  source: "",
  sourceOther: "",
  beneficiaryName: "",
  beneficiaryRelationship: "",
  beneficiaryContact: "",
};

/**
 * The optional opening details to send, or the labels to fix. Blank parts are
 * left out; the server checks the officer and the contact number's form and
 * answers in words.
 */
export function readOpeningDetails(d: OpeningDetailsDraft): { input: SavingsOpeningDetailsInput; problems: string[] } {
  const problems: string[] = [];
  const input: SavingsOpeningDetailsInput = {};
  if (d.officer) input.account_officer_id = d.officer.id;
  if (d.source) {
    input.source_of_funds = d.source;
    if (d.source === "other") {
      const other = d.sourceOther.trim();
      if (other) input.source_of_funds_other = other;
      else problems.push("Source of funds: say where the money comes from");
    }
  }
  const beneficiary: NonNullable<SavingsOpeningDetailsInput["beneficiary"]> = {};
  if (d.beneficiaryName.trim()) beneficiary.name = d.beneficiaryName.trim();
  if (d.beneficiaryRelationship.trim()) beneficiary.relationship = d.beneficiaryRelationship.trim();
  if (d.beneficiaryContact.trim()) beneficiary.contact_number = d.beneficiaryContact.trim();
  if (Object.keys(beneficiary).length) input.beneficiary = beneficiary;
  return { input, problems };
}

const DASH = "—";
const money = (v: string | null | undefined) => (v == null ? DASH : formatCurrency(v));

/** The member check's facts, in words; nulls read "—". */
export function memberCheckRows(check: SavingsOpeningCheck): Array<{ label: string; value: string }> {
  const { member, loans } = check;
  return [
    { label: "Status", value: member.status ? labelOf(MEMBER_STATUS_LABELS, member.status) : DASH },
    { label: "Branch", value: member.branch_name ?? DASH },
    { label: "Member since", value: member.membership_date ? formatDate(member.membership_date) : DASH },
    { label: "Member type", value: member.member_type ? labelOf(MEMBER_TYPE_LABELS, member.member_type) : DASH },
    { label: "Active loans", value: loans.collectible_count == null ? DASH : String(loans.collectible_count) },
    { label: "Loans outstanding", value: money(loans.total_outstanding) },
    { label: "Share capital", value: money(check.share_capital_balance) },
  ];
}

/** The products the server says the member may open, as select options. */
export function openingProductOptions(check: SavingsOpeningCheck | null): Array<{ value: string; label: string }> {
  return (check?.eligible_products ?? []).map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` }));
}

/** The products the member already holds an account in (any status but closed), from the member check. */
export function heldProductIds(check: Pick<SavingsOpeningCheck, "savings_accounts">): Set<string> {
  return new Set(check.savings_accounts.filter((a) => a.status !== "closed").map((a) => String(a.product_id)));
}

/**
 * The member check's last line: what the member can open. When none is open,
 * it says so only for a member who already holds an account in every active
 * regular product; otherwise (no product turned on, or the product rules rule
 * the member out) the dialog's own notice gives the one reason. Nothing while
 * the products load.
 */
export function memberCheckEligibilityNote(
  check: Pick<SavingsOpeningCheck, "eligible_products" | "savings_accounts">,
  products: ReadonlyArray<Pick<SavingsProduct, "id" | "kind" | "is_active">> | null,
): string | null {
  if (check.eligible_products.length > 0) return `Can open: ${check.eligible_products.map((p) => p.name).join(", ")}.`;
  const active = (products ?? []).filter((p) => p.kind === "regular" && p.is_active);
  const held = heldProductIds(check);
  if (active.length === 0 || !active.every((p) => held.has(String(p.id)))) return null;
  return "The member can't open any more savings products: none is open to them, or they already hold one of each.";
}
