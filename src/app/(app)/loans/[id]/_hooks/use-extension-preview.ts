import { useEffect, useState } from "react";
import { loanService } from "@/services";
import { getErrorMessage } from "@/lib/api-error";
import { notifyError } from "@/lib/notify";
import type { ExtensionInterestOption } from "@/types";
import { readExtensionPreview, type ExtensionPreviewView } from "../_lib/extension-preview";

const FALLBACK = "We couldn't preview this extension. Please try again.";

interface Answer {
  key: string;
  preview: ExtensionPreviewView | null;
  error: string | null;
}

/**
 * The server's extension preview for the interest option chosen now, asked
 * for while `request` is set (the Extend dialog is open). `round` asks again
 * for the same option, so a reopened dialog never shows an earlier answer. A
 * request for an option since switched away from is cancelled, and its answer
 * ignored if it arrives anyway, so the dialog only shows figures for the
 * option on screen. A refusal is shown as the server's message.
 */
export function useExtensionPreview(
  request: { loanId: number; option: ExtensionInterestOption; round: number } | null,
): { loading: boolean; preview: ExtensionPreviewView | null; error: string | null } {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const key = request === null ? null : JSON.stringify([request.loanId, request.option, request.round]);

  useEffect(() => {
    if (key === null) return;
    const [id, option] = JSON.parse(key) as [number, ExtensionInterestOption, number];
    const controller = new AbortController();
    loanService
      .extensionPreview(id, option, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        const preview = readExtensionPreview(data, option);
        setAnswer({
          key,
          preview,
          error: preview === null ? "The server's extension preview could not be read." : null,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        notifyError(err, FALLBACK);
        setAnswer({ key, preview: null, error: getErrorMessage(err, FALLBACK) });
      });
    return () => controller.abort();
  }, [key]);

  const current = key !== null && answer?.key === key ? answer : null;
  return {
    loading: key !== null && current === null,
    preview: current?.preview ?? null,
    error: current?.error ?? null,
  };
}
