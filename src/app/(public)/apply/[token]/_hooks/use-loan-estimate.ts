"use client";

import { useEffect, useState } from "react";
import { parseAmount } from "@/lib/loan-origination";
import { publicApplicationService, publicErrorMessage } from "@/services/public-application.service";
import type { ApplicantLoanRequest, LoanEstimate } from "@/types/loan-origination";

type Result = { key: string; estimate: LoanEstimate | null; error: string | null };

/**
 * The server's estimate for the current amount, term and frequency, a moment
 * after they stop changing. The product's own amortization engine computes it;
 * nothing here does loan math.
 */
export function useLoanEstimate(token: string, sessionToken: string | null, loan: ApplicantLoanRequest, valid: boolean) {
  const amount = parseAmount(loan.amount);
  const term = Number(loan.term);
  const key = valid && sessionToken ? `${loan.loan_product_id}|${amount}|${term}|${loan.frequency}` : "";
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!key || !sessionToken || loan.loan_product_id === null || amount === null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      publicApplicationService
        .estimate(
          token,
          sessionToken,
          { loan_product_id: loan.loan_product_id!, amount, term, frequency: loan.frequency || null },
          controller.signal,
        )
        .then((estimate) => setResult({ key, estimate, error: null }))
        .catch((err) => {
          if (!controller.signal.aborted) {
            setResult({ key, estimate: null, error: publicErrorMessage(err, "We could not work out an estimate just now.") });
          }
        });
    }, 600);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, token, sessionToken, loan.loan_product_id, amount, term, loan.frequency]);

  const current = result && result.key === key ? result : null;
  return { estimate: current?.estimate ?? null, error: current?.error ?? null, loading: key !== "" && current === null };
}
