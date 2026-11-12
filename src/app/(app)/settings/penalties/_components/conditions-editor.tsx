"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { sanitizeDecimalInput } from "@/lib/percent";
import type { ConditionRow } from "../_lib/penalty-form";

interface ConditionsEditorProps {
  rows: ConditionRow[];
  onChange: (rows: ConditionRow[]) => void;
  onAdd: () => void;
}

const digitsOnly = (raw: string) => raw.replace(/\D/g, "");

/**
 * The overdue-day brackets: Days Delayed From / To / Penalty %, one row each.
 * Stacks on a phone, a single line from `sm` up. "No maximum" is offered on
 * the last row only, since only the last bracket may be open-ended.
 */
export function ConditionsEditor({ rows, onChange, onAdd }: ConditionsEditorProps) {
  function patch(key: number, change: Partial<ConditionRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  return (
    <div className="space-y-2">
      <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_1fr_1fr_2rem]">
        <span>Days delayed from</span>
        <span>Days delayed to</span>
        <span>Penalty (%)</span>
        <span className="sr-only">Remove</span>
      </div>

      {rows.map((row, i) => {
        const isLast = i === rows.length - 1;
        const n = i + 1;
        return (
          <div key={row.key} className="rounded-md border p-2 sm:border-0 sm:p-0">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_2rem] sm:items-start">
              <div className="space-y-1">
                <Label htmlFor={`pc-from-${row.key}`} className="text-xs sm:sr-only">Days delayed from</Label>
                <Input
                  id={`pc-from-${row.key}`}
                  inputMode="numeric"
                  placeholder="1"
                  aria-label={`Condition ${n} days delayed from`}
                  value={row.from}
                  onChange={(e) => patch(row.key, { from: digitsOnly(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pc-to-${row.key}`} className="text-xs sm:sr-only">Days delayed to</Label>
                <Input
                  id={`pc-to-${row.key}`}
                  inputMode="numeric"
                  placeholder={row.noMax ? "No maximum" : "5"}
                  disabled={row.noMax}
                  aria-label={`Condition ${n} days delayed to`}
                  value={row.noMax ? "" : row.to}
                  onChange={(e) => patch(row.key, { to: digitsOnly(e.target.value) })}
                />
                {isLast && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={row.noMax}
                      onCheckedChange={(checked) => patch(row.key, { noMax: checked === true, to: "" })}
                    />
                    No maximum
                  </label>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`pc-rate-${row.key}`} className="text-xs sm:sr-only">Penalty (%)</Label>
                <Input
                  id={`pc-rate-${row.key}`}
                  inputMode="decimal"
                  placeholder="20"
                  aria-label={`Condition ${n} penalty percentage`}
                  value={row.rate}
                  onChange={(e) => patch(row.key, { rate: sanitizeDecimalInput(e.target.value) })}
                />
              </div>
              <div className="flex items-end justify-end sm:items-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  aria-label={`Remove condition ${n}`}
                  disabled={rows.length === 1}
                  onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Condition
      </Button>
    </div>
  );
}
