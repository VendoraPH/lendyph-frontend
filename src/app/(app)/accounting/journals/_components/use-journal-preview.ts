"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { accountingService } from "@/services";
import type { JournalPreview, JournalPreviewLine } from "@/types";
import { previewErrorMessage } from "../_lib/journal-balance";

/** How long typing has to pause before the totals are asked for. */
export const JOURNAL_PREVIEW_DEBOUNCE_MS = 300;

interface PreviewAnswer {
  /** The request it answers: the lines as sent, and the retry count. */
  key: string;
  preview: JournalPreview | null;
  error: string | null;
}

export interface JournalPreviewState {
  /** The server's totals for the lines on screen; null until they arrive. */
  preview: JournalPreview | null;
  /** Why the request for the lines on screen failed, in words. */
  failed: string | null;
  /** Asks again for the same lines. */
  retry: () => void;
}

interface PreviewOptions {
  /** False for a user without journals:create, who can't ask for it. */
  enabled?: boolean;
  /** The row number on screen of each sent line (`previewLineNumbers`). */
  rowNumbers?: number[];
}

/**
 * The server's totals for `lines` (`POST /accounting/journals/preview`, which
 * needs journals:create).
 *
 * Asked once typing pauses. Only the answer for the lines currently on screen
 * is returned, so a slow reply to older lines is never shown as these lines'
 * totals: until the right answer arrives, `preview` is null.
 */
export function useJournalPreview(
  lines: JournalPreviewLine[],
  { enabled = true, rowNumbers = [] }: PreviewOptions = {},
): JournalPreviewState {
  const [attempt, setAttempt] = useState(0);
  const key = useMemo(() => `${JSON.stringify(lines)}#${attempt}`, [lines, attempt]);
  const [answer, setAnswer] = useState<PreviewAnswer | null>(null);
  const rows = JSON.stringify(rowNumbers);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const sent = JSON.parse(key.slice(0, key.lastIndexOf("#"))) as JournalPreviewLine[];
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
              error: previewErrorMessage(err, JSON.parse(rows) as number[]),
            });
          }
        });
    }, JOURNAL_PREVIEW_DEBOUNCE_MS);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key, enabled, rows]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const settled = enabled && answer?.key === key;
  return {
    preview: settled ? answer.preview : null,
    failed: settled ? answer.error : null,
    retry,
  };
}
