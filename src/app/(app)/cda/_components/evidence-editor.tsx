"use client";

import { Paperclip, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVIDENCE_LIMIT, evidenceWords, linkEvidence } from "../_lib/screen-gaps";
import type { CdaEvidence } from "@/types/cda";
import { EvidenceDocumentPicker } from "./evidence-document-picker";
import { useEvidenceDocuments } from "./evidence-documents";

/**
 * A field's evidence (PUT fields[].evidence): a reference, a note and a linked
 * Compliance Document each, up to the server's 20. Shown read-only, a linked
 * document by its title, where the field doesn't take edits.
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
  const documents = useEvidenceDocuments()?.documents ?? null;

  if (!editable) {
    if (evidence.length === 0) return null;
    return (
      <div className="text-xs text-muted-foreground">
        <p className="font-medium">Evidence</p>
        <ul className="space-y-0.5">
          {evidence.map((entry, i) => (
            <li key={i} className="flex items-start gap-1">
              <Paperclip className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{evidenceWords(entry, documents)}</span>
            </li>
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
      {evidence.map((entry, i) => {
        const name = `${label} evidence ${i + 1}`;
        return (
          <div key={i} className="space-y-2 rounded-md border p-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
              <Input
                aria-label={`${name} reference`}
                placeholder="Reference (e.g. Board Resolution No. 12)"
                maxLength={200}
                value={entry.label ?? ""}
                onChange={(e) => update(i, { label: e.target.value })}
              />
              <Input
                aria-label={`${name} note`}
                placeholder="Note (optional)"
                maxLength={500}
                value={entry.note ?? ""}
                onChange={(e) => update(i, { note: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${name}`}
                onClick={() => onChange(evidence.filter((_, j) => j !== i))}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            <EvidenceDocumentPicker
              entry={entry}
              name={name}
              onLink={(documentId) => onChange(linkEvidence(evidence, i, documentId))}
            />
          </div>
        );
      })}
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
