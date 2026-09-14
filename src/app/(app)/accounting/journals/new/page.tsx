"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Scale } from "lucide-react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useChartOfAccounts } from "@/hooks";
import { accountingService } from "@/services";
import {
  emptyLine,
  summariseDraft,
  validateJournalDraft,
} from "@/lib/accounting/journal";
import { formatCentavos } from "@/lib/accounting/money";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { JournalEntryDraft, JournalLineDraft } from "@/types";
import { AccountingPageHeader } from "../../_components/page-header";
import { JournalLineRows } from "../../_components/journal-line-rows";

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { postable, isTemplate } = useChartOfAccounts();
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [draft, setDraft] = useState<JournalEntryDraft>({
    date: todayISO(),
    reference: "",
    branch_id: null,
    description: "",
    lines: [emptyLine(), emptyLine()],
  });

  const summary = useMemo(() => summariseDraft(draft), [draft]);
  const validation = useMemo(
    () => validateJournalDraft(draft, postable),
    [draft, postable],
  );

  /**
   * Errors stay hidden until the first save attempt.
   *
   * Every draft is invalid the moment it is opened — no account, no amount —
   * and colouring a blank form red tells the user nothing they did not already
   * know. The running balance below is live from the start, which is the
   * feedback that actually helps while typing.
   */
  const showErrors = submitted;
  const errorRows = useMemo(
    () =>
      new Set(
        validation.errors
          .map((e) => e.index)
          .filter((i): i is number => i !== null),
      ),
    [validation],
  );
  const entryErrors = validation.errors.filter((e) => e.index === null);

  const patch = (changes: Partial<JournalEntryDraft>) =>
    setDraft((d) => ({ ...d, ...changes }));

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
    try {
      await accountingService.createJournal(draft);
      toast.success("Draft saved.");
      router.push("/accounting/journals");
    } catch {
      toast.error("Could not save this entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard permission="journals:create" pageName="New Journal Entry">
      <div className="space-y-6">
        <AccountingPageHeader
          title="New Journal Entry"
          description="Saves as a draft. Nothing moves in the books until it is posted."
          actions={
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/accounting/journals" />}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />

        {isTemplate && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <span className="font-medium">Preview only.</span>{" "}
            <span className="text-muted-foreground">
              The accounts listed here are the default template, not your saved
              chart, so this entry cannot be submitted yet. Everything else on
              this form works — including the balance check.
            </span>
          </div>
        )}

        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={draft.date}
                onChange={(e) => patch({ date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={draft.reference}
                onChange={(e) => patch({ reference: e.target.value })}
                placeholder="JV-2026-0001"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
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

            {/*
              The balance check, live on every keystroke. This is the whole
              point of double entry, and it is the one thing a user should
              never have to work out for themselves.
            */}
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 p-4",
                summary.is_balanced
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/5",
              )}
            >
              <div className="flex items-center gap-3">
                <Scale
                  className={cn(
                    "h-5 w-5",
                    summary.is_balanced ? "text-emerald-600" : "text-amber-600",
                  )}
                />
                <div>
                  <p className="font-medium">
                    {summary.is_balanced ? "Balanced" : "Not balanced"}
                  </p>
                  {!summary.is_balanced && (
                    <p className="text-sm text-muted-foreground">
                      Out by {formatCentavos(Math.abs(summary.difference))}.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-8 font-mono text-sm">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Debit</p>
                  <p className="font-medium">{formatCentavos(summary.total_debit)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Credit</p>
                  <p className="font-medium">{formatCentavos(summary.total_credit)}</p>
                </div>
              </div>
            </div>

            {showErrors && validation.errors.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                {entryErrors.map((error, i) => (
                  <li key={i} className="text-sm text-destructive">
                    {error.message}
                  </li>
                ))}
                {validation.errors
                  .filter((e) => e.index !== null)
                  .map((error, i) => (
                    <li key={`line-${i}`} className="text-sm text-destructive">
                      Line {(error.index as number) + 1}: {error.message}
                    </li>
                  ))}
              </ul>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/accounting/journals" />}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || isTemplate}>
                {saving ? "Saving…" : "Save draft"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
