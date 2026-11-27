"use client";

import { useCallback, useState } from "react";
import {
  emptyCoMakerIdDraft,
  idFileProblem,
  type CoMakerIdDraft,
  type CoMakerIdErrors,
  type CoMakerIdField,
} from "@/lib/co-maker-valid-id";

/**
 * The valid-ID draft both co-maker dialogs hold, with its inline errors.
 *
 * Changing a field clears that field's complaint — and changing the type
 * clears the ones that hang off it — while the rest wait for the next check.
 * A picked file is checked on the spot, so a file the API would refuse is
 * turned away before anything is saved.
 */
export function useCoMakerIdDraft() {
  const [draft, setDraft] = useState<CoMakerIdDraft>(emptyCoMakerIdDraft);
  const [errors, setErrors] = useState<CoMakerIdErrors>({});

  const change = useCallback((patch: Partial<CoMakerIdDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      for (const field of Object.keys(patch) as CoMakerIdField[]) delete next[field];
      if ("type" in patch) {
        // The duplicate check keys on type and number together.
        delete next.id_number;
        delete next.custom_type_name;
      }
      return next;
    });
  }, []);

  /** Take a picked file (or `null` to clear it); returns false when refused. */
  const pickFile = useCallback(
    (file: File | null): boolean => {
      const problem = file ? idFileProblem(file) : null;
      if (problem) {
        setDraft((current) => ({ ...current, file: null }));
        setErrors((current) => ({ ...current, file: problem }));
        return false;
      }
      change({ file });
      return true;
    },
    [change]
  );

  const reset = useCallback(() => {
    setDraft(emptyCoMakerIdDraft());
    setErrors({});
  }, []);

  return { draft, errors, setErrors, change, pickFile, reset };
}
