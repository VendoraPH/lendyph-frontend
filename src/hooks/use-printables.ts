"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { findPrintable } from "@/lib/printables/catalog";
import {
  applyPrintChrome,
  resolvePrintableOrg,
} from "@/lib/printables/print-chrome";
import { openPrintable } from "@/lib/printables/print-open";
import type {
  PrintableDefinition,
  PrintableDocument,
  PrintableId,
  PrintableOrg,
} from "@/lib/printables/types";

/**
 * Open a catalog document from wherever the work happens — a loan, a payment,
 * a member — instead of sending staff to `/printables` to re-pick a subject
 * they already have open.
 *
 * This is the same sequence `printables/[printableId]/page.tsx` runs (resolve
 * letterhead → build → apply chrome → open), lifted into a hook because three
 * detail pages now need it. Nothing about the document changes based on where
 * it was opened from: the catalog remains the single definition of every
 * printable, so a fix to a template reaches every entry point at once.
 */

export interface UsePrintablesResult {
  /** Catalog entries for `ids`, in the order given. Unknown ids are dropped. */
  menu: (ids: PrintableId[]) => PrintableDefinition[];
  /** Build and open one document for one subject. Never throws. */
  open: (id: PrintableId, subjectId: number) => Promise<void>;
  /** The document currently being prepared, for a per-item spinner. */
  pendingId: PrintableId | null;
  /** True while any document is being prepared. */
  isPreparing: boolean;
}

/**
 * Resolve the letterhead, build, stamp chrome, open, and say how it went.
 * Never throws. Shared by `usePrintables` and screens that print a document
 * outside the catalog (a savings receipt, built from the posting's response).
 */
export async function openDocument(
  title: string,
  build: (org: PrintableOrg) => Promise<PrintableDocument>
): Promise<void> {
  try {
    // Resolved per open rather than held in state: branding can change
    // under a long-lived session, and the store's shared in-flight fetch
    // makes the repeat calls free.
    const org = await resolvePrintableOrg();
    const doc = applyPrintChrome(await build(org));

    switch (openPrintable(doc)) {
      case "opened":
        // `incomplete` means the record behind an asserting document — a
        // receipt, a certificate — could not be read, so the figures on it
        // are blanks. It still opens (the blank is a usable form), but
        // "opened in a new tab" is the wrong thing to say about it.
        if (doc.incomplete) {
          toast.warning(
            `${title} opened, but its record couldn't be loaded — the figures are blank. Check the details before issuing it.`
          );
        } else {
          toast.success(`${title} opened in a new tab.`);
        }
        break;
      case "popup_blocked":
        toast.error("Allow pop-ups for this site to print the document.");
        break;
      case "unavailable":
        toast.error("This browser can't open the document for printing.");
        break;
    }
  } catch {
    // The builders fail soft — a rejected request still yields a blank
    // form. Reaching here means the open itself broke.
    toast.error("We couldn't prepare the document. Please try again.");
  }
}

export function usePrintables(): UsePrintablesResult {
  const [pendingId, setPendingId] = useState<PrintableId | null>(null);

  const open = useCallback(
    async (id: PrintableId, subjectId: number) => {
      const printable = findPrintable(id);
      if (!printable || !subjectId) return;

      setPendingId(id);
      try {
        await openDocument(printable.title, (org) => printable.build({ subjectId, org }));
      } finally {
        setPendingId(null);
      }
    },
    []
  );

  const menu = useCallback(
    (ids: PrintableId[]) =>
      ids.flatMap((id) => {
        const printable = findPrintable(id);
        return printable ? [printable] : [];
      }),
    []
  );

  return useMemo(
    () => ({ menu, open, pendingId, isPreparing: pendingId !== null }),
    [menu, open, pendingId]
  );
}
