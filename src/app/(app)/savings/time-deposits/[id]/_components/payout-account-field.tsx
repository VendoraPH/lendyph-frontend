"use client";

import { useCallback } from "react";
import { useApiResource } from "@/hooks";
import { formatCurrency } from "@/lib/format";
import { savingsService } from "@/services";
import type { SavingsAccount, TimeDeposit } from "@/types";
import { FormField } from "../../../_components/field";
import { OptionSelect } from "../../../_components/option-select";
import { payoutAccounts } from "../../_lib/settle-form";

/** The member's own active savings accounts in the placement's branch, loaded while `enabled`. */
export function usePayoutAccounts(
  deposit: Pick<TimeDeposit, "borrower_id" | "branch_id">,
  enabled: boolean,
): { offered: SavingsAccount[]; loading: boolean } {
  const fetcher = useCallback(
    () =>
      savingsService.accounts({
        borrower_id: deposit.borrower_id,
        branch_id: deposit.branch_id ?? undefined,
        status: "active",
        per_page: 100,
      }),
    [deposit.borrower_id, deposit.branch_id],
  );
  const resource = useApiResource(fetcher, enabled);
  return { offered: payoutAccounts(deposit, resource.data?.data ?? []), loading: resource.loading };
}

interface PayoutAccountFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  offered: readonly SavingsAccount[];
  loading: boolean;
  error: string | null;
}

/** Which of the member's savings accounts a payout goes into. Paying into savings needs no approval. */
export function PayoutAccountField({ id, value, onChange, offered, loading, error }: PayoutAccountFieldProps) {
  return (
    <FormField
      id={id}
      label="Into account"
      error={error}
      hint={
        !loading && offered.length === 0
          ? "The member has no active savings account in this branch. Pick another payout method."
          : "Paid into savings at once, with no approval needed."
      }
    >
      <OptionSelect
        id={id}
        value={value}
        onChange={onChange}
        options={offered.map((a) => ({
          value: String(a.id),
          label: `${a.account_number} · ${a.product.name} · ${formatCurrency(a.balance)}`,
        }))}
        placeholder={loading ? "Loading…" : "Choose an account"}
        disabled={loading || offered.length === 0}
      />
    </FormField>
  );
}
