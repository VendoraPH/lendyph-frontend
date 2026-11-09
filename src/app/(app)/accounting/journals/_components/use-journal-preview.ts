"use client";

import { useEffect, useMemo, useState } from "react";
import { accountingService } from "@/services";
import { getErrorMessage } from "@/lib/api-error";
import type { JournalPreview, JournalPreviewLine } from "@/types";

/** How long typing has to pause before the totals are asked for. */
export const JOURNAL_PREVIEW_DEBOUNCE_MS = 300;

interface PreviewAnswer {
  /** The lines it answers, as sent. */
  key: string;
  preview: JournalPreview | null;
  error: string | null;
}

export interface JournalPreviewState {
  /** The server's totals for the lines on screen; null until they arrive. */
  preview: JournalPreview | null;
  /** The message of a failed request for the lines on screen. */
  failed: string | null;
}

/**
 * The server's totals for `lines` (`POST /accounting/journals/preview`, which
 * needs journals:create; pass `enabled: false` for a user without it).
 *
 * Asked once typing pauses. Only the answer for the lines currently on screen
 * is returned, so a slow reply to older lines is never shown as these lines'
 * totals: until the right answer arrives, `preview` is null.
 */
export function useJournalPreview(
  lines: JournalPreviewLine[],
  enabled = true,
): JournalPreviewState {
  const key = useMemo(() => JSON.stringify(lines), [lines]);
  const [answer, setAnswer] = useState<PreviewAnswer | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const sent = JSON.parse(key) as JournalPreviewLine[];
    const timer = setTimeout(() => {
      accountingService
        .previewJournal(sent)
        .then((preview) => {
          if (current) setAnswer({ key, preview, error: null });
        })
        .catch((err: unknown) => {
          if (current) {
            setAnswer({
              key,
              preview: null,
              error: getErrorMessage(err, "The totals couldn't be checked. Keep typing to try again."),
            });
          }
        });
    }, JOURNAL_PREVIEW_DEBOUNCE_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key, enabled]);

  const settled = enabled && answer?.key === key;
  return {
    preview: settled ? answer.preview : null,
    failed: settled ? answer.error : null,
  };
}
