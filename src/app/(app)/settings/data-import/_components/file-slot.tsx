"use client";

/**
 * One labelled drop-zone for one named CSV.
 *
 * There are two of these on step 1 and there is deliberately no way to make it
 * one control that takes two files. A `multiple` input hands back a positional
 * array, and the whole contract downstream is keyed — `ImportFileKind` is
 * `"customers" | "loans"`, both endpoints key by it, and the server has no way
 * to tell which file is which except by the key we send. Positional means the
 * admin who picks loans-then-members imports every loan row as a member and
 * every member row as a loan, and both halves fail row by row with messages
 * about the wrong columns. Two slots, each with its own label, makes that
 * unrepresentable.
 */

import { useId, useRef, useState } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CSV_FILE_ACCEPT, looksLikeCsv } from "@/lib/csv-file";
import { cn } from "@/lib/utils";

export interface FileSlotProps {
  /** Shown on the label, e.g. "Members file". */
  label: string;
  /** One line under the label: what this file is, in the admin's words. */
  description: string;
  /** The columns or shape expected. Rendered as help text, tied by aria. */
  hint?: string;
  file: File | null;
  /** `null` when the pick is rejected or cleared, so the parent never holds a bad File. */
  onSelect: (file: File | null) => void;
  optional?: boolean;
  disabled?: boolean;
}

/** Presentation only. Bytes are exact everywhere they matter (chunking). */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

export function FileSlot({
  label,
  description,
  hint,
  file,
  onSelect,
  optional = false,
  disabled = false,
}: FileSlotProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function accept(picked: File | null) {
    if (!picked) {
      setError(null);
      onSelect(null);
      return;
    }

    // `looksLikeCsv`, NOT `validateUploadFile`: that helper's allowlist is MIME
    // types, and a CSV's MIME type comes from the OS rather than the bytes —
    // the same file arrives as text/csv, application/vnd.ms-excel or "" purely
    // depending on what owns the .csv association. Its 5 MB ceiling is an
    // ID-photo limit too, and a member migration is routinely bigger.
    //
    // No `maxBytes` is passed, and that is the considered answer rather than an
    // oversight: the upload is chunked at a size the SERVER advertises, so there
    // is no number here with anything real behind it, and `looksLikeCsv`
    // documents that inventing one blocks the one migration this page exists
    // for. Whether the content is usable is settled by the parse on step 2.
    const result = looksLikeCsv(picked);
    if (!result.ok) {
      setError(result.error ?? "That file cannot be used.");
      onSelect(null);
      return;
    }

    setError(null);
    onSelect(picked);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    accept(event.target.files?.[0] ?? null);
    // Clear the control's own value so re-picking the SAME path fires `change`
    // again — otherwise an admin who fixes the file on disk and re-picks it gets
    // silence, and concludes the page is broken.
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;

    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 1) {
      setError(
        `Drop one file here. The members and loans files go in separate slots, because the importer has to know which is which.`,
      );
      return;
    }
    accept(dropped[0] ?? null);
  }

  function clear() {
    accept(null);
    inputRef.current?.focus();
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "rounded-xl border border-dashed p-4 transition-colors",
        dragging ? "border-brand-orange bg-brand-orange/5" : "border-border",
        error && "border-destructive/60",
        disabled && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
            file
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-muted text-muted-foreground",
          )}
        >
          {file ? (
            <FileSpreadsheet className="size-4" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <Label htmlFor={inputId} className="text-sm font-medium">
            {label}
            {optional ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            ) : (
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>

          {file ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="truncate rounded-md bg-muted px-2 py-1 text-xs font-medium">
                {file.name}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {fileSize(file.size)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={clear}
                disabled={disabled}
              >
                <X className="size-3.5" aria-hidden="true" />
                Remove
                <span className="sr-only"> {label}</span>
              </Button>
            </div>
          ) : null}

          <input
            ref={inputRef}
            id={inputId}
            type="file"
            // Single, always. See the note at the top of this file.
            accept={CSV_FILE_ACCEPT}
            disabled={disabled}
            onChange={handleChange}
            aria-invalid={error ? true : undefined}
            aria-describedby={cn(hint && hintId, error && errorId) || undefined}
            className="mt-2.5 block w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed"
          />

          {hint ? (
            <p id={hintId} className="mt-1.5 text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}

          {error ? (
            <p
              id={errorId}
              role="alert"
              className="mt-1.5 text-xs font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
