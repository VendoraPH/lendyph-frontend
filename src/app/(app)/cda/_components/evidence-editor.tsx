"use client";

import { Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVIDENCE_LIMIT } from "../_lib/screen-gaps";
import type { CdaEvidence } from "@/types/cda";

function EvidenceLine({ entry }: { entry: CdaEvidence }) {
  return (
    <li className="flex items-start gap-1">
      <Paperclip className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      <span>
        {entry.label || (entry.document_id ? "A filed document" : "Evidence")}
        {entry.note && <> · {entry.note}</>}
        {entry.document_id && entry.label && <> · linked to a filed document</>}
      </span>
    </li>
  );
}

/**
 * A field's evidence (PUT fields[].evidence): a reference and a note each,
 * up to the server's 20. A link to a filed document is kept as it was. Shown
 * read-only where the field doesn't take edits.
 */
export function EvidenceEditor({
  label,
  evidence,
  editable,
  onChange,
}: {
  label: string;
  evidence: CdaEvidence[];
  editable: boolean;
  onChange: (next: CdaEvidence[]) => void;
}) {
  if (!editable) {
    if (evidence.length === 0) return null;
    return (
      <div className="text-xs text-muted-foreground">
        <p className="font-medium">Evidence</p>
        <ul className="space-y-0.5">
          {evidence.map((entry, i) => (
            <EvidenceLine key={i} entry={entry} />
          ))}
        </ul>
      </div>
    );
  }

  const update = (index: number, patch: Partial<CdaEvidence>) =>
    onChange(evidence.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-muted-foreground">Evidence</legend>
      {evidence.map((entry, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
          <Input
            aria-label={`${label} evidence ${i + 1} reference`}
            placeholder="Reference (e.g. Board Resolution No. 12)"
            maxLength={200}
            value={entry.label ?? ""}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <Input
            aria-label={`${label} evidence ${i + 1} note`}
            placeholder={entry.document_id ? "Note (linked to a filed document)" : "Note (optional)"}
            maxLength={500}
            value={entry.note ?? ""}
            onChange={(e) => update(i, { note: e.target.value })}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${label} evidence ${i + 1}`}
            onClick={() => onChange(evidence.filter((_, j) => j !== i))}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="xs"
        onClick={() => onChange([...evidence, { label: "", note: "" }])}
        disabled={evidence.length >= EVIDENCE_LIMIT}
      >
        <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        Add evidence
      </Button>
    </fieldset>
  );
}
