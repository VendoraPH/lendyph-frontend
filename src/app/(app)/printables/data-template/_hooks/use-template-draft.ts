"use client";

import { useCallback, useMemo, useState } from "react";
import { createDraft, mapSheet } from "@/lib/data-template/draft";
import { validateDraft } from "@/lib/data-template/validate";
import type { TemplateSheet } from "@/lib/data-template/types";

/**
 * The edited copy of the template, and the only place it lives.
 *
 * Every mutation is a `sheet -> sheet` function from `lib/data-template/draft`,
 * so this hook holds state and nothing else — no rules, no validation of its
 * own. `useState(createDraft)` rather than `useState(createDraft())`: the
 * initialiser must not rebuild a 22-column workbook on every render.
 */
export function useTemplateDraft() {
  const [draft, setDraft] = useState(createDraft);

  const update = useCallback(
    (sheetId: string, fn: (sheet: TemplateSheet) => TemplateSheet) => {
      setDraft((current) => mapSheet(current, sheetId, fn));
    },
    []
  );

  const reset = useCallback(() => setDraft(createDraft()), []);

  const issues = useMemo(() => validateDraft(draft), [draft]);

  return { draft, issues, update, reset };
}
