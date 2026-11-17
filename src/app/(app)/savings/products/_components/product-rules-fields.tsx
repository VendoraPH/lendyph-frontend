"use client";

import { useCallback, useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApiResource } from "@/hooks";
import { FORM_STEP_GRID } from "@/lib/form-stepper";
import { branchService } from "@/services";
import type { SavingsMemberType } from "@/types";
import { FormField } from "../../_components/field";
import { OptionSelect } from "../../_components/option-select";
import { MEMBER_TYPE_LABELS } from "../../_lib/opening-draft";
import { MEMBER_TYPES, type ProductDraft } from "../_lib/product-draft";

type LimitKey = "maxBalance" | "minDeposit" | "maxDeposit" | "minWithdrawal" | "maxWithdrawal";
type SwitchKey = "allowDeposits" | "allowWithdrawals" | "allowTransfers";

interface ProductRulesFieldsProps {
  draft: ProductDraft;
  set: <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => void;
  /** Loads the branch list only while the dialog is open. */
  open: boolean;
}

const EXCESS_OPTIONS = [
  { value: "fee", label: "Charge a fee for each one" },
  { value: "refuse", label: "Refuse the withdrawal" },
];

/** The payload key behind each switch, for an error to focus. */
const SWITCH_FIELDS: Record<SwitchKey, string> = {
  allowDeposits: "allow_deposits",
  allowWithdrawals: "allow_withdrawals",
  allowTransfers: "allow_transfers",
};

const SWITCHES: ReadonlyArray<{ key: SwitchKey; label: string; hint: string }> = [
  { key: "allowDeposits", label: "Deposits", hint: "Members can pay money in." },
  { key: "allowWithdrawals", label: "Withdrawals", hint: "Members can take money out." },
  { key: "allowTransfers", label: "Transfers", hint: "Money can move to the member's other accounts." },
];

/**
 * The product's rules (gap round S1): limits, the monthly free withdrawals and
 * what happens beyond them, what the product allows, and who may open it. A
 * time deposit product shows eligibility only. Every limit is checked by the
 * server, which answers in words. Each part is its own step of the product
 * dialog: `ProductLimitsFields`, `ProductAllowedFields` and
 * `ProductEligibilityFields`.
 */
export function ProductLimitsFields({ draft, set }: Omit<ProductRulesFieldsProps, "open">) {
  const uid = useId();

  const limit = (key: LimitKey, field: string, label: string) => (
    <FormField id={`${uid}-${key}`} field={field} label={label}>
      <Input
        id={`${uid}-${key}`}
        inputMode="decimal"
        value={draft[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder="No limit"
      />
    </FormField>
  );

  return (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Limits</legend>
        <p className="text-xs text-muted-foreground">In pesos. Leave a field blank for no limit.</p>
        <div className={FORM_STEP_GRID.roomy}>
          {limit("maxBalance", "max_balance", "Maximum balance")}
          {limit("minDeposit", "min_deposit", "Minimum deposit")}
          {limit("maxDeposit", "max_deposit", "Maximum deposit")}
          {limit("minWithdrawal", "min_withdrawal", "Minimum withdrawal")}
          {limit("maxWithdrawal", "max_withdrawal", "Maximum withdrawal")}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Withdrawals</legend>
        <div className={FORM_STEP_GRID.roomy}>
          <FormField
            id={`${uid}-free`}
            field="free_withdrawals_per_month"
            label="Free withdrawals a month"
            hint="Blank for no limit."
          >
            <Input
              id={`${uid}-free`}
              inputMode="numeric"
              value={draft.freeWithdrawals}
              onChange={(e) => set("freeWithdrawals", e.target.value)}
              placeholder="No limit"
            />
          </FormField>
          {draft.freeWithdrawals.trim() !== "" && (
            <>
              <FormField id={`${uid}-excess`} label="Beyond the free count">
                <OptionSelect
                  id={`${uid}-excess`}
                  value={draft.excessMode}
                  onChange={(v) => set("excessMode", v === "refuse" ? "refuse" : "fee")}
                  options={EXCESS_OPTIONS}
                />
              </FormField>
              {draft.excessMode === "fee" && (
                <FormField
                  id={`${uid}-fee`}
                  field="excess_withdrawal_fee"
                  label="Excess-withdrawal fee"
                  hint="₱0.00 charges nothing."
                >
                  <Input
                    id={`${uid}-fee`}
                    inputMode="decimal"
                    value={draft.excessFee}
                    onChange={(e) => set("excessFee", e.target.value)}
                    placeholder="0.00"
                  />
                </FormField>
              )}
            </>
          )}
        </div>
      </fieldset>
    </div>
  );
}

/** What a regular product allows. The step's heading reads "Allowed", so the legend is for screen readers. */
export function ProductAllowedFields({ draft, set }: Omit<ProductRulesFieldsProps, "open">) {
  const uid = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Allowed</legend>
      <div className={FORM_STEP_GRID.roomy}>
        {SWITCHES.map((s) => (
          <div
            key={s.key}
            data-field={SWITCH_FIELDS[s.key]}
            className="flex items-start justify-between gap-2 rounded-lg border p-3"
          >
            <div>
              <Label htmlFor={`${uid}-${s.key}`}>{s.label}</Label>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </div>
            <Switch id={`${uid}-${s.key}`} checked={draft[s.key]} onCheckedChange={(v) => set(s.key, Boolean(v))} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Who may open the product. The step's heading reads "Eligibility", so the
 * legend is for screen readers. The branch list scrolls inside its own box.
 */
export function ProductEligibilityFields({ draft, set, open }: ProductRulesFieldsProps) {
  const uid = useId();
  // Inactive branches too, so one the product already lists can still be unticked.
  const fetchBranches = useCallback(() => branchService.listAll(), []);
  const branches = useApiResource(fetchBranches, open);

  const toggleType = (type: SavingsMemberType, on: boolean) =>
    set("memberTypes", on ? [...draft.memberTypes.filter((t) => t !== type), type] : draft.memberTypes.filter((t) => t !== type));
  const toggleBranch = (id: number, on: boolean) =>
    set("branchIds", on ? [...draft.branchIds.filter((b) => b !== id), id] : draft.branchIds.filter((b) => b !== id));

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Eligibility</legend>
      <p className="text-xs text-muted-foreground">
        Leave a list with nothing ticked to open the product to everyone.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div role="group" aria-labelledby={`${uid}-types`} data-field="eligible_member_types" className="space-y-2">
          <p id={`${uid}-types`} className="text-sm">Member types</p>
          {MEMBER_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <Checkbox checked={draft.memberTypes.includes(type)} onCheckedChange={(c) => toggleType(type, c === true)} />
              {MEMBER_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
        <div role="group" aria-labelledby={`${uid}-branches`} data-field="eligible_branch_ids" className="space-y-2">
          <p id={`${uid}-branches`} className="text-sm">Branches</p>
          {branches.loading ? (
            <p className="text-xs text-muted-foreground">Loading branches…</p>
          ) : branches.error || branches.unavailable ? (
            <p className="text-xs text-destructive">Couldn&apos;t load the branches. Close and open the form again.</p>
          ) : (branches.data?.rows ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No branches yet.</p>
          ) : (
            <div className="max-h-40 space-y-2 overflow-auto pr-1">
              {(branches.data?.rows ?? []).map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={draft.branchIds.includes(b.id)} onCheckedChange={(c) => toggleBranch(b.id, c === true)} />
                  {b.name}
                  {!b.is_active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </fieldset>
  );
}
