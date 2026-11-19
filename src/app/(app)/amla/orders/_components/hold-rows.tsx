"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { AmlaOrderForm } from "@/lib/amla/screening-view";
import type { AmlaOption } from "@/lib/amla/settings-view";

type Holds = AmlaOrderForm["holds"];

interface Props {
  holds: Holds;
  /** The member's own savings accounts, with the server's available balance. */
  options: AmlaOption[];
  state: "no_access" | "no_member" | "loading" | "failed" | "ready";
  disabled: boolean;
  onChange: (holds: Holds) => void;
}

const NOTES: Record<Exclude<Props["state"], "ready">, string> = {
  no_access: "Placing holds needs access to savings accounts. The order can still be recorded without holds.",
  no_member: "Pick the member to hold any of their savings accounts.",
  loading: "Loading the member's savings accounts…",
  failed: "The member's savings accounts couldn't be loaded.",
};

/** The holds an order places: an account of the member's own and an amount each. The server checks each fits. */
export function HoldRows({ holds, options, state, disabled, onChange }: Props) {
  const update = (index: number, next: Partial<Holds[number]>) => onChange(holds.map((h, i) => (i === index ? { ...h, ...next } : h)));

  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">Savings holds (optional)</legend>
      {state !== "ready" ? (
        <p className="text-sm text-muted-foreground">{NOTES[state]}</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">This member has no savings accounts to hold.</p>
      ) : (
        <>
          {holds.map((hold, index) => (
            <div key={index} className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1 space-y-1">
                <Label htmlFor={`hold-account-${index}`}>Account</Label>
                <NativeSelect id={`hold-account-${index}`} className="w-full" value={hold.accountId} disabled={disabled} onChange={(e) => update(index, { accountId: e.target.value })}>
                  <NativeSelectOption value="">Pick an account</NativeSelectOption>
                  {options.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`hold-amount-${index}`}>Amount (₱)</Label>
                <Input id={`hold-amount-${index}`} inputMode="decimal" className="w-40" value={hold.amount} disabled={disabled} onChange={(e) => update(index, { amount: e.target.value })} />
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove hold ${index + 1}`} disabled={disabled} onClick={() => onChange(holds.filter((_, i) => i !== index))}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...holds, { accountId: "", amount: "" }])}>
            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
            Add a hold
          </Button>
        </>
      )}
    </fieldset>
  );
}
