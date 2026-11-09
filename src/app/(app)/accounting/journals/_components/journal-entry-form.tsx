"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { useChartOfAccounts } from "@/hooks";
import {
  emptyLine,
  previewLineNumbers,
  previewLines,
  validateJournalDraft,
} from "@/lib/accounting/journal";
import type { JournalEntryDraft, JournalLineDraft } from "@/types";
import { JournalLineRows } from "../../_components/journal-line-rows";
import { JournalBalancePanel } from "./journal-balance-panel";
import { useJournalPreview } from "./use-journal-preview";

interface JournalEntryFormProps {
  initial: JournalEntryDraft;
  /** Saves the draft. A rejection keeps the form open; the caller reports it. */
  onSave: (draft: JournalEntryDraft) => Promise<void>;
  saveLabel: string;
  /** The Cancel control, a link or a button. */
  cancel: React.ReactNode;
}

/**
 * The manual entry editor, shared by New Entry and editing a draft: the date,
 * reference and description, the lines, and the server's totals for them.
 */
export function JournalEntryForm({ initial, onSave, saveLabel, cancel }: JournalEntryFormProps) {
  const { postable, isTemplate, truncated, total } = useChartOfAccounts();
  const [draft, setDraft] = useState<JournalEntryDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const lines = useMemo(() => previewLines(draft), [draft]);
  const rowNumbers = useMemo(() => previewLineNumbers(draft), [draft]);
  const { preview, failed, retry } = useJournalPreview(lines, { rowNumbers });
  const validation = useMemo(
    () => validateJournalDraft(draft, postable, preview, failed),
    [draft, postable, preview, failed],
  );

  /**
   * Errors stay hidden until the first save attempt. Every draft is invalid
   * the moment it is opened, and colouring a blank form red tells the user
   * nothing; the totals below are live from the start.
   */
  const showErrors = submitted;
  const errorRows = useMemo(
    () =>
      new Set(
        validation.errors.map((e) => e.index).filter((i): i is number => i !== null),
      ),
    [validation],
  );
  const entryErrors = validation.errors.filter((e) => e.index === null);
  const lineErrors = validation.errors.filter((e) => e.index !== null);

  const patch = (changes: Partial<JournalEntryDraft>) => setDraft((d) => ({ ...d, ...changes }));

  const patchLine = (index: number, changes: Partial<JournalLineDraft>) =>
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((line, i) => (i === index ? { ...line, ...changes } : line)),
    }));

  const addLine = () => setDraft((d) => ({ ...d, lines: [...d.lines, emptyLine()] }));

  const removeLine = (index: number) =>
    setDraft((d) => ({ ...d, lines: d.lines.filter((_, i) => i !== index) }));

  const save = async () => {
    setSubmitted(true);
    if (!validation.ok) {
      toast.error("This entry is not ready to save.");
      return;
    }
    setSaving(true);
    // `.finally` rather than try/finally, which the React Compiler skips.
    await onSave(draft).finally(() => setSaving(false));
  };

  return (
    <div className="space-y-6">
      {/*
        A picker missing rows reads as "that account does not exist", and an
        account the chart drain never reached cannot be posted to at all.
      */}
      {truncated && (
        <IncompleteListNotice
          shown={postable.length}
          total={total}
          noun="accounts"
          consequence="An account missing from the chart cannot be selected on a line below."
        />
      )}

      {isTemplate && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <span className="font-medium">Preview only.</span>{" "}
          <span className="text-muted-foreground">
            The accounts listed here are the default template, not your saved chart, so this
            entry cannot be submitted yet. Everything else on this form works, including the
            balance check.
          </span>
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="journal-date">Date</Label>
            <Input
              id="journal-date"
              type="date"
              value={draft.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="journal-reference">Reference</Label>
            <Input
              id="journal-reference"
              value={draft.reference}
              onChange={(e) => patch({ reference: e.target.value })}
              placeholder="JV-2026-0001"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="journal-description">Description</Label>
            <Textarea
              id="journal-description"
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="What is this entry for?"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <JournalLineRows
            lines={draft.lines}
            accounts={postable}
            errorRows={showErrors ? errorRows : new Set()}
            onChange={patchLine}
            onRemove={removeLine}
          />

          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" />
            Add line
          </Button>

          <JournalBalancePanel preview={preview} failed={failed} onRetry={retry} />

          {showErrors && validation.errors.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              {entryErrors.map((error, i) => (
                <li key={i} className="text-sm text-destructive">
                  {error.message}
                </li>
              ))}
              {lineErrors.map((error, i) => (
                <li key={`line-${i}`} className="text-sm text-destructive">
                  Line {(error.index as number) + 1}: {error.message}
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2">
            {cancel}
            <Button onClick={save} disabled={saving || isTemplate}>
              {saving ? "Saving…" : saveLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
