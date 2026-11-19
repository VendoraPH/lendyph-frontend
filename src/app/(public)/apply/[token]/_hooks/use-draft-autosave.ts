"use client";

import { useEffect, useRef, useState } from "react";
import { publicApplicationService } from "@/services/public-application.service";
import type { ApplicationDraft } from "@/types/loan-origination";

export type SaveState = "idle" | "saving" | "saved" | "error";

const DELAY_MS = 1500;

/**
 * Saves the draft to the server a moment after the applicant stops typing,
 * once a session exists. Only the latest change is sent; a save that fails is
 * retried with the next change, and `flush` saves now (Next, or leaving).
 */
export function useDraftAutosave(
  token: string,
  sessionToken: string | null,
  draft: ApplicationDraft,
  lastStep: string,
) {
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef({ draft, lastStep });
  const dirty = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    latest.current = { draft, lastStep };
    // The draft as loaded is already saved.
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
  }, [draft, lastStep]);

  const save = () => {
    if (!sessionToken || !dirty.current) return Promise.resolve();
    dirty.current = false;
    setState("saving");
    const { draft: d, lastStep: s } = latest.current;
    return publicApplicationService
      .saveDraft(token, sessionToken, d, s)
      .then(() => setState("saved"))
      .catch(() => {
        dirty.current = true;
        setState("error");
      });
  };
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    if (!sessionToken) return;
    const timer = window.setTimeout(() => void saveRef.current(), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, lastStep, sessionToken]);

  return { state, flush: () => saveRef.current() };
}
