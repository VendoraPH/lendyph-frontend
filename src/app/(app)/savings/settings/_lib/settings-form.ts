import type { DayCountBasis, SavingsSettings } from "@/types/savings";

export interface SettingsForm {
  account_number_prefix: string;
  account_number_include_branch: boolean;
  account_number_padding: string;
  day_count_basis: DayCountBasis;
  require_reversal_approval: boolean;
  require_interest_approval: boolean;
  allow_inactive_member_opening: boolean;
  dormancy_days: string;
}

export const MIN_PADDING = 4;
export const MAX_PADDING = 12;

export function settingsToForm(s: SavingsSettings): SettingsForm {
  return {
    ...s,
    account_number_padding: String(s.account_number_padding),
    dormancy_days: String(s.dormancy_days),
  };
}

/**
 * What the next account number would look like. Illustrative only: the
 * server assigns the real number when the account is opened.
 */
export function accountNumberPreview(
  form: Pick<SettingsForm, "account_number_prefix" | "account_number_include_branch" | "account_number_padding">,
  branchCode = "01",
  sequence = 1,
): string {
  const pad = Math.min(MAX_PADDING, Math.max(1, Number(form.account_number_padding) || MIN_PADDING));
  const parts = [form.account_number_prefix.trim().toUpperCase()];
  if (form.account_number_include_branch) parts.push(branchCode);
  parts.push(String(sequence).padStart(pad, "0"));
  return parts.filter(Boolean).join("-");
}

export type SettingsCheck =
  | { ok: true; payload: SavingsSettings }
  | { ok: false; fields: string[] };

const PREFIX = /^[A-Za-z0-9]{0,10}$/;

export function formToSettings(form: SettingsForm): SettingsCheck {
  const fields: string[] = [];
  const prefix = form.account_number_prefix.trim();
  if (!PREFIX.test(prefix)) fields.push("Account number prefix (letters and digits, up to 10)");

  const padding = Number(form.account_number_padding);
  if (!Number.isInteger(padding) || padding < MIN_PADDING || padding > MAX_PADDING) {
    fields.push(`Sequence digits (${MIN_PADDING}–${MAX_PADDING})`);
  }

  const dormancy = Number(form.dormancy_days);
  if (!/^\d+$/.test(form.dormancy_days.trim()) || dormancy < 1) fields.push("Days before dormant");

  if (fields.length > 0) return { ok: false, fields };
  return {
    ok: true,
    payload: {
      account_number_prefix: prefix.toUpperCase(),
      account_number_include_branch: form.account_number_include_branch,
      account_number_padding: padding,
      day_count_basis: form.day_count_basis,
      require_reversal_approval: form.require_reversal_approval,
      require_interest_approval: form.require_interest_approval,
      allow_inactive_member_opening: form.allow_inactive_member_opening,
      dormancy_days: dormancy,
    },
  };
}
