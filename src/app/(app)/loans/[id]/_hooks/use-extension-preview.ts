import { useEffect, useState } from "react";
import { loanService } from "@/services";
import { notifyError } from "@/lib/notify";
import type { ExtensionInterestOption } from "@/types";
import {
  EXTENSION_PREVIEW_FALLBACK,
  extensionPreviewAnswer,
  extensionPreviewKey,
  extensionPreviewState,
  type ExtensionPreviewAnswer,
  type ExtensionPreviewView,
} from "../_lib/extension-preview";

/**
 * The server's extension preview for the interest option chosen now, asked
 * for while `request` is set (the Extend dialog is open). `round` asks again
 * for the same option: on every open, and after a failed extension, so the
 * dialog never shows an earlier answer. A request for an option since
 * switched away from is cancelled, and its answer ignored if it arrives
 * anyway (see `extensionPreviewState`). A refusal is shown as the server's
 * message and toasted; a cancelled request is neither.
 */
export function useExtensionPreview(
  request: { loanId: number; option: ExtensionInterestOption; round: number } | null,
): { loading: boolean; preview: ExtensionPreviewView | null; error: string | null } {
  const [answer, setAnswer] = useState<ExtensionPreviewAnswer | null>(null);
  const key = extensionPreviewKey(request);

  useEffect(() => {
    if (key === null) return;
    const [id, option] = JSON.parse(key) as [number, ExtensionInterestOption, number];
    const controller = new AbortController();
    const settle = (outcome: { data: unknown } | { error: unknown }) => {
      const settled = extensionPreviewAnswer(key, option, outcome, controller.signal.aborted);
      if (settled === null) return;
      if (settled.failed && "error" in outcome) notifyError(outcome.error, EXTENSION_PREVIEW_FALLBACK);
      setAnswer(settled);
    };
    loanService
      .extensionPreview(id, option, controller.signal)
      .then((data) => settle({ data }))
      .catch((error: unknown) => settle({ error }));
    return () => controller.abort();
  }, [key]);

  return extensionPreviewState(key, answer);
}
