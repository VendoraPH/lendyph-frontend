"use client";

import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDate } from "@/lib/format";
import { isPayable } from "@/lib/portal/finance";
import { REQUEST_TYPES, type RequestFieldKind } from "@/lib/portal/requests";
import { portalService } from "@/services/portal.service";
import type { PortalRequestType } from "@/types/portal";

export interface PickerOption {
  value: string;
  label: string;
}

// Module-level so useApiResource sees a stable fetcher.
const fetchLoans = () => portalService.loans();
const fetchSavings = () => portalService.savings();
const fetchTimeDeposits = () => portalService.timeDeposits();
const fetchSavingsProducts = () => portalService.savingsProducts();

/**
 * The member's own records a request form can pick from, loaded only when the
 * chosen request type asks for them.
 */
export function useRequestPickers(type: PortalRequestType | null) {
  const kinds = new Set<RequestFieldKind>(type ? REQUEST_TYPES[type].fields.map((f) => f.kind) : []);
  const loans = useApiResource(fetchLoans, kinds.has("loan"));
  const savings = useApiResource(fetchSavings, kinds.has("savings_account"));
  const timeDeposits = useApiResource(fetchTimeDeposits, kinds.has("time_deposit"));
  const savingsProducts = useApiResource(fetchSavingsProducts, kinds.has("savings_product"));

  const options: Partial<Record<RequestFieldKind, PickerOption[]>> = {
    loan: (loans.data ?? [])
      .filter((l) => isPayable(l.status))
      .map((l) => ({ value: String(l.id), label: `${l.product_name} · ${l.loan_number}` })),
    savings_account: (savings.data ?? []).map((a) => ({
      value: String(a.id),
      label: `${a.product_name} · ${a.account_number}`,
    })),
    time_deposit: (timeDeposits.data ?? [])
      .filter((td) => td.status === "active")
      .map((td) => ({
        value: String(td.id),
        label: `${td.certificate_number} · ${formatCurrency(td.principal)} · matures ${formatDate(td.maturity_date)}`,
      })),
    savings_product: (savingsProducts.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
  };
  const loading: Partial<Record<RequestFieldKind, boolean>> = {
    loan: loans.loading,
    savings_account: savings.loading,
    time_deposit: timeDeposits.loading,
    savings_product: savingsProducts.loading,
  };

  return {
    options,
    loading,
    savingsAccounts: savings.data ?? [],
    savingsProducts: savingsProducts.data ?? [],
  };
}
