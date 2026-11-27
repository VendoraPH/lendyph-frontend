"use client";

import { useRef, type ChangeEvent } from "react";
import { FileText } from "lucide-react";
import { ID_ACCEPT } from "@/lib/file-validation";

interface ValidIdFilePickerProps {
  /** The button's id, unique per row and side; the visible "Front of ID" label points at it. */
  controlId: string;
  side: "front" | "back";
  /** The row for screen readers, e.g. "Passport (ID 2)" (see validIdRowName). */
  rowName: string;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * The picker for one side of a valid ID on the member forms, before a file is
 * chosen. A real button opens the hidden file input, as on the co-maker ID
 * form, so Tab reaches it, Enter or Space opens the file dialog, and focus
 * shows.
 */
export function ValidIdFilePicker({ controlId, side, rowName, onPick }: ValidIdFilePickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        id={controlId}
        aria-label={`Upload ${side} of ${rowName}`}
        onClick={() => fileInput.current?.click()}
        className="flex h-44 w-full flex-col items-center justify-center gap-1 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">Upload {side === "front" ? "Front" : "Back"}</span>
      </button>
      <input ref={fileInput} type="file" accept={ID_ACCEPT} onChange={onPick} className="hidden" />
    </>
  );
}
