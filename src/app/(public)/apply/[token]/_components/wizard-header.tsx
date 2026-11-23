"use client";

import { CloudOff, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SaveState } from "../_hooks/use-draft-autosave";

const SAVE_LABELS: Record<SaveState, string> = { idle: "", saving: "Saving…", saved: "Saved", error: "Not saved yet" };

/**
 * Above the open step: where the applicant is, the server's completion, the
 * save status, sign-out, and what the server says the step still needs.
 */
export function WizardHeader({
  index,
  total,
  title,
  completion,
  saveState,
  leaving,
  onSignOut,
  messages,
  problem,
}: {
  index: number;
  total: number;
  title: string;
  /** The server's completion percent, once there is an application. */
  completion: number | null;
  /** Null before there is a session to save with. */
  saveState: SaveState | null;
  leaving: boolean;
  onSignOut: (() => void) | null;
  messages: string[];
  problem: string | null;
}) {
  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Step {index + 1} of {total}
            {completion !== null && ` · ${completion}% complete`}
          </span>
          <span className="flex items-center gap-3">
            {saveState && saveState !== "idle" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
                {saveState === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
                {saveState === "error" && <CloudOff className="h-3 w-3" />}
                {SAVE_LABELS[saveState]}
              </span>
            )}
            {onSignOut && (
              <Button variant="ghost" size="sm" onClick={onSignOut} disabled={leaving} aria-busy={leaving}>
                <LogOut className="mr-1 h-4 w-4" /> Save and sign out
              </Button>
            )}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full bg-brand-orange transition-[width]" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      {messages.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <p>Check these before you go on:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      {problem && (
        <p className="text-sm text-destructive" role="alert">
          {problem}
        </p>
      )}
    </>
  );
}
