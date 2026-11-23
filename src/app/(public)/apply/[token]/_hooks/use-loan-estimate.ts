"use client";

import { useEffect, useRef, useState } from "react";
import { publicApplicationService } from "@/services/public-application.service";
import type { EstimateRequest, PublicEstimate } from "@/types/public-application";
import { publicErrorMessage } from "../_lib/errors";

type Result = { key: string; estimate: PublicEstimate | null; error: string | null };

/**
 * The server's estimate for the request, a moment after it stops changing.
 * The loan form's own preview works it out; nothing here does loan maths. A
 * refusal (an amount outside the product, say) shows in the server's words;
 * `onFailed` takes a session refusal instead.
 */
export function useLoanEstimate(
  token: string,
  sessionToken: string | null,
  request: EstimateRequest | null,
  onFailed: (err: unknown) => boolean,
) {
  const key = request && sessionToken ? JSON.stringify(request) : "";
  const [result, setResult] = useState<Result | null>(null);
  const handler = useRef(onFailed);

  useEffect(() => {
    handler.current = onFailed;
  });

  useEffect(() => {
    if (!key || !sessionToken) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      publicApplicationService
        .estimate(token, sessionToken, JSON.parse(key) as EstimateRequest, controller.signal)
        .then((estimate) => setResult({ key, estimate, error: null }))
        .catch((err) => {
          if (controller.signal.aborted || handler.current(err)) return;
          setResult({ key, estimate: null, error: publicErrorMessage(err, "We could not work out an estimate just now.") });
        });
    }, 600);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, token, sessionToken]);

  const current = result && result.key === key ? result : null;
  return { estimate: current?.estimate ?? null, error: current?.error ?? null, loading: key !== "" && current === null };
}
