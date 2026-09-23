"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { IdCard, Loader2, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/common";
import { Button } from "@/components/ui/button";
import { fileUrl } from "@/lib/file-url";
import { formatDate } from "@/lib/format";
import { validIdTypeLabel } from "@/lib/co-maker-valid-id";
import type { CoMakerValidId } from "@/services/co-maker.service";
import type { ValidIdsStatus } from "../_hooks/use-co-maker-valid-ids";

interface CoMakerValidIdsOnFileProps {
  ids: CoMakerValidId[];
  status: ValidIdsStatus;
  removingId: number | null;
  onRetry: () => void;
  onRemove: (validIdId: number) => Promise<boolean>;
  disabled?: boolean;
}

/**
 * The IDs a co-maker already has, each with a link to its file and a way to
 * remove it. The links are the signed URLs the API returns — good for 30
 * minutes, which a dialog outlives only if left open. Removing asks once,
 * then deletes straight away; it does not wait for Save.
 */
export function CoMakerValidIdsOnFile({
  ids,
  status,
  removingId,
  onRetry,
  onRemove,
  disabled,
}: CoMakerValidIdsOnFileProps) {
  const [confirming, setConfirming] = useState<number | null>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const removeButtons = useRef(new Map<number, HTMLElement>());

  // Keyboard focus follows the question: onto "Keep" when it is asked, back to
  // the row's remove button when it is withdrawn. Each swap removes the button
  // that had focus, and the dialog's focus trap answers a focused element
  // vanishing by pulling focus to the dialog itself — on the next frame, so an
  // effect or a requestAnimationFrame loses that race. Committing the swap
  // synchronously and focusing straight after means focus is never loose.
  const swapFocus = (next: number | null, focus: () => void) => {
    flushSync(() => setConfirming(next));
    focus();
  };

  if (status === "loading") {
    return (
      <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Checking for an ID on file…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"
      >
        We couldn&apos;t load the IDs on file.
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (ids.length === 0) {
    return <p className="text-xs text-muted-foreground">No ID on file yet.</p>;
  }

  return (
    <ul className="space-y-2" aria-label="IDs on file">
      {ids.map((entry) => {
        const label = validIdTypeLabel(entry.type, entry.custom_type_name);
        const removing = removingId === entry.id;
        return (
          <li
            key={entry.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2"
          >
            <IdCard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.id_number || "No ID number"} · Added {formatDate(entry.created_at)}
              </p>
            </div>

            {confirming === entry.id ? (
              <div role="group" aria-label={`Remove ${label}?`} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Remove this ID now?</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={removing}
                  onClick={async () => {
                    if (await onRemove(entry.id)) setConfirming(null);
                  }}
                >
                  {removing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                  Remove
                </Button>
                <Button
                  ref={keepButton}
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={removing}
                  onClick={() =>
                    swapFocus(null, () => removeButtons.current.get(entry.id)?.focus())
                  }
                >
                  Keep
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {entry.front_url && (
                  <a
                    href={fileUrl(entry.front_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded px-2 py-1 text-xs font-medium text-brand-orange hover:underline"
                  >
                    View<span className="sr-only"> {label}</span>
                  </a>
                )}
                {entry.back_url && (
                  <a
                    href={fileUrl(entry.back_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded px-2 py-1 text-xs font-medium text-brand-orange hover:underline"
                  >
                    View back<span className="sr-only"> of {label}</span>
                  </a>
                )}
                {/* The API lets anyone with borrowers:update upload an ID but
                    only borrowers:delete remove one — loan officers can add,
                    not remove — so the action is hidden from everyone else. */}
                <PermissionGate permission="borrowers:delete">
                  <Button
                    ref={(el) => {
                      if (el) removeButtons.current.set(entry.id, el);
                      else removeButtons.current.delete(entry.id);
                    }}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Remove ${label}`}
                    title="Remove"
                    disabled={disabled}
                    onClick={() => swapFocus(entry.id, () => keepButton.current?.focus())}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </PermissionGate>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
