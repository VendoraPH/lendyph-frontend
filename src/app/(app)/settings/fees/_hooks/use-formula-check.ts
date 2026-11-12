import { useEffect, useMemo, useState } from "react";
import { feeService } from "@/services";
import { firstFieldError, getErrorMessage, httpStatusOf } from "@/lib/api-error";
import {
  buildFeeFormulaCheckRequest, DEFAULT_FORMULA_SAMPLE, formulaExpressionError, type FormulaSampleInput,
} from "@/lib/fee-form";
import type { FeeFormulaCheck, FeeFormulaCheckRequest } from "@/types/fee";

/** How long typing must pause before the formula goes to the server. */
const CHECK_DELAY_MS = 400;

export type FormulaCheckState =
  | { status: "idle" }
  | { status: "incomplete"; message: string }
  | { status: "checking" }
  | { status: "valid"; result: FeeFormulaCheck }
  | { status: "invalid"; message: string }
  | { status: "failed"; message: string };

interface Answer {
  body: FeeFormulaCheckRequest;
  attempt: number;
  state: FormulaCheckState;
}

function answerFor(err: unknown): FormulaCheckState {
  if (httpStatusOf(err) === 422) {
    const message = formulaExpressionError(err) ?? firstFieldError(err);
    if (message) return { status: "invalid", message };
  }
  return { status: "failed", message: getErrorMessage(err, "We couldn't check the formula. Please try again.") };
}

/**
 * The server's check of a written formula on an editable sample loan, sent
 * about 400 ms after typing stops. Only the latest answer counts: an older
 * reply never overwrites a newer formula's, and saving waits for `valid`.
 */
export function useFormulaCheck(input: { enabled: boolean; expression: string; minAmount: string; maxAmount: string }) {
  const { enabled, expression, minAmount, maxAmount } = input;
  const [sample, setSample] = useState<FormulaSampleInput>(DEFAULT_FORMULA_SAMPLE);
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);

  const request = useMemo(
    () => (enabled ? buildFeeFormulaCheckRequest(expression, sample, { minAmount, maxAmount }) : null),
    [enabled, expression, sample, minAmount, maxAmount],
  );
  const body = request && "body" in request ? request.body : null;

  useEffect(() => {
    if (!body) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      feeService.checkFormula(body, controller.signal).then(
        (result) => {
          if (controller.signal.aborted) return;
          setAnswer({
            body, attempt,
            state: result.valid
              ? { status: "valid", result }
              : { status: "invalid", message: "The server didn't accept this formula." },
          });
        },
        (err: unknown) => {
          if (controller.signal.aborted) return;
          setAnswer({ body, attempt, state: answerFor(err) });
        },
      );
    }, CHECK_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body, attempt]);

  let state: FormulaCheckState;
  if (!request) state = { status: "idle" };
  else if ("error" in request) state = { status: "incomplete", message: request.error };
  else if (answer && answer.body === body && answer.attempt === attempt) state = answer.state;
  else state = { status: "checking" };

  return {
    sample,
    setSample,
    state,
    /** Saving needs the server's answer for exactly what's on screen. */
    valid: state.status === "valid",
    retry: () => setAttempt((n) => n + 1),
  };
}

export type FormulaCheck = ReturnType<typeof useFormulaCheck>;
