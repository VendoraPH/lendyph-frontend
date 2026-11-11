"use client";

import { useMemo, useRef, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useDialogOpening } from "@/hooks";
import { notifyError } from "@/lib/notify";
import { penaltyConfigService } from "@/services";
import type { LoanProduct } from "@/types/loan";
import type { PenaltyConfig } from "@/types/penalty";
import {
  activeProductOwners, appendRow, buildPenaltyPayload, parseConditions, productConflicts, toRow, uncoveredDays, type ConditionRow,
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

  // Every product held by another active configuration, for the picker's hints.
  const takenBy = useMemo(() => activeProductOwners(configs, config?.id ?? null), [configs, config]);
  const conflicts = productConflicts(productIds, takenBy);
  const productName = (id: number) => products.find((p) => p.id === id)?.name ?? `Product #${id}`;

  const parsed = parseConditions(rows);
  const gaps = "conditions" in parsed ? uncoveredDays(parsed.conditions) : [];

  function addRow() {
    nextKey.current = Math.max(nextKey.current, ...rows.map((r) => r.key)) + 1;
    setRows(appendRow(rows, nextKey.current));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    // An inactive configuration may be edited without products; it needs one to be switched back on.
    const requireProducts = config?.status !== "inactive";
    const result = buildPenaltyPayload({ name, productIds, rows }, { requireProducts });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (requireProducts && conflicts.length > 0) {
      const c = conflicts[0];
      setError(`${productName(c.productId)} already follows "${c.configName}". Remove it there first, or deactivate that configuration.`);
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
      notifyError(err, isEdit ? "We couldn't update the penalty configuration." : "We couldn't create the penalty configuration.");
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
            Set the penalty rate by how many days a repayment is overdue. Only the one condition the overdue days
            fall in applies — conditions are not added together.
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
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="penalty-products">
              Applicable Loan Products <span className="text-destructive">*</span>
            </Label>
            <ProductMultiSelect
              id="penalty-products"
              products={products}
              value={productIds}
              onChange={setProductIds}
              takenBy={takenBy}
              invalid={conflicts.length > 0}
            />
            {conflicts.length > 0 ? (
              <p className="text-xs text-destructive">
                {conflicts.map((c) => `${productName(c.productId)} already follows "${c.configName}"`).join("; ")}.
                A loan product can follow one active penalty configuration only.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                A loan product can follow one active penalty configuration at a time.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Penalty Conditions <span className="text-destructive">*</span>
            </Label>
            <ConditionsEditor rows={rows} onChange={setRows} onAdd={addRow} />
            {gaps.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                No penalty for {gaps.join(", ")} overdue — no condition covers {gaps.length === 1 ? "it" : "them"}.
              </p>
            )}
          </div>

          {isEdit && (
            <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              Changes apply to penalties charged from now on. Penalties already charged keep the rate they were charged at.
            </p>
          )}

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
