"use client";

import { useEffect, useMemo, useState } from "react";
import { useChartOfAccounts } from "@/hooks";
import { reconciliationAccounts } from "../_lib/reconciliation-api";
import { startAccounts, type StartAccounts, type StartAccountsAnswer } from "../_lib/start-accounts";

/**
 * The money accounts a reconciliation can be started on: the server's
 * reconcilable-accounts list, read once, or the chart's money accounts when
 * the backend doesn't have that list yet. The chart is read only with
 * `chart_of_accounts:view` (useChartOfAccounts), as before.
 */
export function useStartAccounts(): StartAccounts {
  const [answer, setAnswer] = useState<StartAccountsAnswer>({ state: "loading" });
  const { postable, isTemplate, loading } = useChartOfAccounts();

  useEffect(() => {
    let cancelled = false;
    reconciliationAccounts().then((next) => {
      if (!cancelled) setAnswer(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const moneyAccounts = useMemo(() => postable.filter((a) => Boolean(a.cash_kind)), [postable]);
  return useMemo(
    () => startAccounts(answer, { loading, isTemplate, moneyAccounts }),
    [answer, loading, isTemplate, moneyAccounts],
  );
}
