"use client";

import { useEffect, useRef, useState } from "react";
import { publicApplicationService } from "@/services/public-application.service";
import type { ApplicationDraft } from "@/types/loan-origination";
import type { PublicApplicationState } from "@/types/public-application";

export type SaveState = "idle" | "saving" | "saved" | "error";

const DELAY_MS = 1500;

interface AutosaveOptions {
  token: string;
  sessionToken: string | null;
  draft: ApplicationDraft;
  /** The server's view after each save: completion, last step, missing fields and declared totals. */
  onSaved: (state: PublicApplicationState) => void;
  /** Every failed save, so a session refusal can end the wizard. */
  onFailed: (err: unknown) => void;
}

/**
 * Saves the draft to the server a moment after the applicant stops typing,
 * once a session exists. Saves run one after another, so the server's answers
 * arrive in order, and only the latest change is sent. A failed save is tried
 * again with the next change. `flush` saves now and resolves with the server's
 * latest view of the application (null before the first save), or rejects
 * with the refusal.
 */
export function useDraftAutosave({ token, sessionToken, draft, onSaved, onFailed }: AutosaveOptions) {
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef(draft);
  const dirty = useRef(false);
  const first = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const lastSaved = useRef<PublicApplicationState | null>(null);
  const handlers = useRef({ onSaved, onFailed });

  useEffect(() => {
    handlers.current = { onSaved, onFailed };
  });

  useEffect(() => {
    latest.current = draft;
    // The draft as loaded is already saved.
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
  }, [draft]);

  const save = (): Promise<PublicApplicationState | null> => {
    const run = (): Promise<PublicApplicationState | null> => {
      if (!sessionToken || !dirty.current) return Promise.resolve(lastSaved.current);
      dirty.current = false;
      setState("saving");
      return publicApplicationService.saveDraft(token, sessionToken, latest.current).then(
        (saved) => {
          lastSaved.current = saved;
          setState("saved");
          handlers.current.onSaved(saved);
          return saved;
        },
        (err: unknown) => {
          dirty.current = true;
          setState("error");
          handlers.current.onFailed(err);
          throw err;
        },
      );
    };
    const next = queue.current.then(run, run);
    queue.current = next.catch(() => undefined);
    return next;
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    if (!sessionToken) return;
    const timer = window.setTimeout(() => void saveRef.current().catch(() => undefined), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, sessionToken]);

  return { state, flush: () => saveRef.current() };
}
