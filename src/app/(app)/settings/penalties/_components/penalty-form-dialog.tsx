"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useDialogOpening } from "@/hooks";
import { getErrorMessage } from "@/lib/api-error";
import { penaltyConfigService } from "@/services";
import type { LoanProduct } from "@/types/loan";
import type { PenaltyConfig } from "@/types/penalty";
import {
  PENALTY_FORM_NOTE, activeProductOwners, appendRow, buildPenaltyPayload, toRow, type ConditionRow,
} from "../_lib/penalty-form";
import { ConditionsEditor } from "./conditions-editor";
import { ProductMultiSelect } from "./product-multi-select";

interface PenaltyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The configuration being edited; null to create one. */
  config: PenaltyConfig | null;
  configs: PenaltyConfig[];
  products: LoanProduct[];
  onSaved: () => void;
}

const BLANK_ROW: Omit<ConditionRow, "key"> = { from: "1", to: "", noMax: false, rate: "" };

export function PenaltyFormDialog({ open, onOpenChange, config, configs, products, onSaved }: PenaltyFormDialogProps) {
  const isEdit = config !== null;
  const nextKey = useRef(0);
  const [name, setName] = useState("");
  const [productIds, setProductIds] = useState<number[]>([]);
  const [rows, setRows] = useState<ConditionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (useDialogOpening(open, config)) {
    setName(config?.name ?? "");
    setProductIds(config?.applicable_product_ids ?? []);
    setRows(
      config && config.conditions.length > 0
        ? config.conditions.map((c, i) => toRow(c, i))
        : [{ key: 0, ...BLANK_ROW }],
    );
    setError(null);
  }

  // Products another active configuration covers, as hints in the picker only.
  const takenBy = useMemo(() => activeProductOwners(configs, config?.id ?? null), [configs, config]);

  function addRow() {
    nextKey.current = Math.max(nextKey.current, ...rows.map((r) => r.key)) + 1;
    setRows(appendRow(rows, nextKey.current));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    // Completeness only; product clashes and bracket ranges are the server's
    // rules, and its 409 or 422 is shown below as sent.
    const result = buildPenaltyPayload({ name, productIds, rows });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (config) {
        await penaltyConfigService.update(config.id, result.payload);
        toast.success("Penalty configuration updated");
      } else {
        await penaltyConfigService.create(result.payload);
        toast.success("Penalty configuration created");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, isEdit ? "We couldn't update the penalty configuration." : "We couldn't create the penalty configuration."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Penalty Configuration" : "New Penalty Configuration"}</DialogTitle>
          <DialogDescription>
            Set the penalty rate by days late. Each late penalty charge uses the rate of the one condition its
            days late fall in; conditions are not added together.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="penalty-name">
              Penalty Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="penalty-name"
              placeholder="e.g. Standard Overdue Penalty"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="penalty-products">
              Applicable Loan Products
            </Label>
            <ProductMultiSelect
              id="penalty-products"
              products={products}
              value={productIds}
              onChange={setProductIds}
              takenBy={takenBy}
            />
            <p className="text-xs text-muted-foreground">
              An active configuration needs at least one loan product, and a loan product can be in one active
              configuration at a time.
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              Penalty Conditions <span className="text-destructive">*</span>
            </Label>
            <ConditionsEditor rows={rows} onChange={setRows} onAdd={addRow} />
          </div>

          <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
            {PENALTY_FORM_NOTE}
          </p>

          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Configuration"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
