"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BLANK_LINE, DESCRIPTION_MAX, REFERENCE_MAX, type DraftLine } from "../_lib/statement-form";

interface StatementLinesEditorProps {
  lines: DraftLine[];
  disabled: boolean;
  onChange: (lines: DraftLine[]) => void;
}

/** The statement's lines, typed in: date, description, signed amount in pesos, and reference. */
export function StatementLinesEditor({ lines, disabled, onChange }: StatementLinesEditorProps) {
  const update = (index: number, field: keyof DraftLine, value: string) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)));

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[9rem_1fr_8rem_8rem_2rem] gap-2 text-xs text-muted-foreground sm:grid">
        <span>Date</span>
        <span>Description</span>
        <span className="text-right">Amount</span>
        <span>Reference</span>
        <span />
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {lines.map((line, index) => {
          const number = index + 1;
          return (
            <div key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-[9rem_1fr_8rem_8rem_2rem]">
              <Input
                type="date"
                aria-label={`Line ${number} date`}
                value={line.date}
                disabled={disabled}
                onChange={(e) => update(index, "date", e.target.value)}
              />
              <Input
                aria-label={`Line ${number} description`}
                placeholder="Description"
                value={line.description}
                maxLength={DESCRIPTION_MAX}
                disabled={disabled}
                onChange={(e) => update(index, "description", e.target.value)}
              />
              <Input
                aria-label={`Line ${number} amount in pesos, money out negative`}
                placeholder="-150.00"
                value={line.amount}
                disabled={disabled}
                className="text-right font-mono"
                onChange={(e) => update(index, "amount", e.target.value)}
              />
              <Input
                aria-label={`Line ${number} reference`}
                placeholder="Reference"
                value={line.reference}
                maxLength={REFERENCE_MAX}
                disabled={disabled}
                onChange={(e) => update(index, "reference", e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove line ${number}`}
                disabled={disabled}
                onClick={() => onChange(lines.filter((_, i) => i !== index))}
              >
                <X className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...lines, { ...BLANK_LINE }])}
      >
        <Plus className="mr-1 size-4" />
        Add line
      </Button>
    </div>
  );
}
