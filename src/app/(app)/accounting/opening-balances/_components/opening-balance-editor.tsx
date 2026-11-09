"use client";

import { useState } from "react";
import { Plus, Scale } from "lucide-react";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChartOfAccounts } from "@/hooks";
import { notifySuccess } from "@/lib/notify";
import { accountingService } from "@/services";
import type { OpeningBalance } from "@/types";
import {
  buildDraft,
  editorLinesFrom,
  equityAccountId,
  requestFailure,
  suggestionOffer,
  withSuggestedLine,
  type EditorLine,
} from "../_lib/opening-balances";
import { EditorLinesTable } from "./editor-lines-table";
import { FinalisePanel } from "./finalise-panel";
import { OpeningBalanceFigures } from "./opening-balance-figures";

interface OpeningBalanceEditorProps {
  /** The server's last answer. The parent remounts this editor on each new one. */
  opening: OpeningBalance;
  onAnswer: (opening: OpeningBalance) => void;
  onConflict: () => void;
}

/**
 * The draft: an As of date and the lines. Save sends the whole list; the
 * server answers with every figure, which this editor shows until the next
 * edit. It never balances the entry itself: the 3050 line is the server's
 * offer, added only when the user asks.
 */
export function OpeningBalanceEditor({ opening, onAnswer, onConflict }: OpeningBalanceEditorProps) {
  const { postable, isTemplate, truncated, total } = useChartOfAccounts();
  const [asOf, setAsOf] = useState(opening.as_of ?? "");
  const [lines, setLines] = useState<EditorLine[]>(() => editorLinesFrom(opening));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorRows, setErrorRows] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const offer = suggestionOffer(opening, dirty);
  const equityId =
    equityAccountId(opening) ?? postable.find((account) => account.code === "3050")?.id ?? null;

  const edit = (next: EditorLine[]) => {
    setLines(next);
    setDirty(true);
  };

  const save = (rows: EditorLine[]) => {
    const built = buildDraft(asOf, rows, opening.edit_version);
    if (!built.ok) {
      setErrors(built.errors.map((error) => error.message));
      setErrorRows(new Set(built.errors.flatMap((error) => (error.index === null ? [] : [error.index]))));
      return;
    }
    setSaving(true);
    setErrors([]);
    setErrorRows(new Set());
    accountingService
      .saveOpeningBalances(built.draft)
      .then((answer) => {
        notifySuccess("Opening balances saved.");
        onAnswer(answer);
      })
      .catch((err: unknown) => {
        const failure = requestFailure(err, built.rowOf);
        if (failure.kind === "conflict") {
          onConflict();
          return;
        }
        setErrors([failure.message]);
        setErrorRows(new Set(failure.rows));
      })
      .then(() => setSaving(false));
  };

  const putDifferenceOnEquity = () => {
    if (!offer) return;
    const next = withSuggestedLine(lines, offer.line);
    setLines(next);
    save(next);
  };

  return (
    <div className="space-y-6">
      {truncated && (
        <IncompleteListNotice
          shown={postable.length}
          total={total}
          noun="accounts"
          consequence="An account missing from the chart cannot be chosen on a line below."
        />
      )}
      {isTemplate && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          The organisation&apos;s chart of accounts couldn&apos;t be read (it needs Chart of
          Accounts: View), so the opening balances can&apos;t be saved from here.
        </div>
      )}

      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="opening-as-of">As of</Label>
        <Input
          id="opening-as-of"
          type="date"
          value={asOf}
          onChange={(e) => {
            setAsOf(e.target.value);
            setDirty(true);
          }}
          disabled={saving}
        />
      </div>

      <EditorLinesTable
        lines={lines}
        accounts={postable}
        equityAccountId={equityId}
        errorRows={errorRows}
        disabled={saving}
        onChange={(index, patch) =>
          edit(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)))
        }
        onRemove={(index) => edit(lines.filter((_, i) => i !== index))}
      />

      {errors.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => edit([...lines, { account_id: null, debit: "", credit: "" }])}
          disabled={saving}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add line
        </Button>
        <Button onClick={() => save(lines)} disabled={saving || isTemplate}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <OpeningBalanceFigures opening={opening} dirty={dirty} />

      {offer && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            The server suggests <span className="font-medium">{offer.amount}</span> on 3050
            Opening Balance Equity for the difference.
          </p>
          <Button variant="outline" onClick={putDifferenceOnEquity} disabled={saving || isTemplate}>
            <Scale className="mr-2 h-4 w-4" />
            {offer.label}
          </Button>
        </div>
      )}

      {opening.status === "draft" && (
        <FinalisePanel opening={opening} dirty={dirty} onAnswer={onAnswer} onConflict={onConflict} />
      )}
    </div>
  );
}
