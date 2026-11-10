import { parseMoneyInput } from "@/lib/money-input";
import type { SavingsHolderType, SavingsSettings, SavingsSettingsInput, SavingsTaxRuleInput } from "@/types";
import { rateProblem } from "../../products/_lib/product-draft";

export interface SettingsDraft {
  tier1: string;
  tier2: string;
  checkers: string;
  dormancy: string;
  alert: string;
}

export function toSettingsDraft(s: SavingsSettings): SettingsDraft {
  return {
    tier1: s.tier1_limit,
    tier2: s.tier2_limit,
    checkers: String(s.tier3_checkers),
    dormancy: String(s.dormancy_months),
    alert: s.large_transaction_alert,
  };
}

const WHOLE = /^\d+$/;

/**
 * `PUT /savings/settings`, or the labels to fix. Amounts are sent as typed
 * (two-decimal text). The server checks that the second tier is above the
 * first and answers 422 in words if it isn't.
 */
export function readSettingsDraft(d: SettingsDraft): { input: SavingsSettingsInput; problems: string[] } {
  const problems: string[] = [];
  const money = (raw: string, label: string) => {
    const parsed = parseMoneyInput(raw, { label });
    if (!parsed.ok) problems.push(label);
    return parsed.ok ? parsed.value : "";
  };
  const input = {
    tier1_limit: money(d.tier1, "Approval needed above"),
    tier2_limit: money(d.tier2, "Two approvers needed above"),
    tier3_checkers: WHOLE.test(d.checkers.trim()) ? Number(d.checkers) : 0,
    dormancy_months: WHOLE.test(d.dormancy.trim()) ? Number(d.dormancy) : 0,
    large_transaction_alert: money(d.alert, "Large transaction alert"),
  };
  if (input.tier3_checkers < 2) problems.push("Approvers above the second amount (2 or more)");
  if (input.dormancy_months < 1) problems.push("Dormant after (months)");
  return { input, problems };
}

/** `POST /savings/tax-rules`, or the labels to fix. Append-only, from today or later. */
export function readTaxRule(
  holderType: SavingsHolderType,
  rate: string,
  effectiveFrom: string,
  today: string,
): { input: SavingsTaxRuleInput; problems: string[] } {
  const problems: string[] = [];
  const rateError = rateProblem(rate, "Tax rate");
  if (rateError) problems.push(rateError);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || effectiveFrom < today) problems.push("Effective from (today or later)");
  return { input: { holder_type: holderType, rate: rate.trim(), effective_from: effectiveFrom }, problems };
}
