"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionButton } from "@/components/common/permission-button";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsProduct } from "@/types";
import { FormField } from "../../_components/field";
import { MAX_TIERS, readTierDraft, type TierDraft } from "../_lib/rate-draft";

interface TierRateFormProps {
  product: SavingsProduct;
  today: string;
  onAdded: () => void;
}

const fresh = (today: string): TierDraft => ({ baseRate: "", tiers: [], effectiveFrom: today });

/**
 * A regular product's new rates for one date: the base rate ("Any balance")
 * and any "₱X and up" tiers, each with its annual rate (gap round S2). The
 * whole ladder replaces the date's rates; earlier dates stay in the history.
 * The server checks the order and answers in words. Render it with
 * `key={product.id}` so another product starts blank.
 */
export function TierRateForm({ product, today, onAdded }: TierRateFormProps) {
  const uid = useId();
  const [draft, setDraft] = useState<TierDraft>(() => fresh(today));
  const { submitting, run } = useSubmitGuard();

  const setTier = (i: number, key: "minBalance" | "rate", value: string) =>
    setDraft((d) => ({ ...d, tiers: d.tiers.map((t, j) => (j === i ? { ...t, [key]: value } : t)) }));

  function save() {
    const { input, problems } = readTierDraft(draft, today);
    if (problems.length) return notifyValidation(problems);
    run(() => savingsService.addRateTiers(product.id, input))
      ?.then(() => {
        const tiers = input.tiers.length;
        notifySuccess(
          "Rates added",
          `${tiers === 1 ? "One rate" : `${tiers} tiers`} from ${formatDate(input.effective_from)}`,
        );
        setDraft(fresh(today));
        onAdded();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't add the rates."));
  }

  return (
    <div className="space-y-3">
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <p className="self-center text-sm font-medium sm:pb-2">Any balance</p>
        <FormField id={`${uid}-base`} label="Annual rate (%)">
          <Input
            id={`${uid}-base`}
            inputMode="decimal"
            value={draft.baseRate}
            onChange={(e) => setDraft((d) => ({ ...d, baseRate: e.target.value }))}
            placeholder="0.5000"
          />
        </FormField>
        <span className="hidden w-9 sm:block" aria-hidden />
      </div>

      {draft.tiers.map((tier, i) => (
        <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <FormField id={`${uid}-min-${i}`} label={`Tier ${i + 1}: balance of ₱ and up`}>
            <Input
              id={`${uid}-min-${i}`}
              inputMode="decimal"
              value={tier.minBalance}
              onChange={(e) => setTier(i, "minBalance", e.target.value)}
              placeholder="10000.00"
            />
          </FormField>
          <FormField id={`${uid}-rate-${i}`} label="Annual rate (%)">
            <Input
              id={`${uid}-rate-${i}`}
              inputMode="decimal"
              value={tier.rate}
              onChange={(e) => setTier(i, "rate", e.target.value)}
              placeholder="1.2500"
            />
          </FormField>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove tier ${i + 1}`}
            onClick={() => setDraft((d) => ({ ...d, tiers: d.tiers.filter((_, j) => j !== i) }))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDraft((d) => ({ ...d, tiers: [...d.tiers, { minBalance: "", rate: "" }] }))}
          disabled={draft.tiers.length + 1 >= MAX_TIERS}
        >
          <Plus className="h-4 w-4" /> Add a tier
        </Button>
        <FormField id={`${uid}-from`} label="Effective from">
          <Input
            id={`${uid}-from`}
            type="date"
            min={today}
            value={draft.effectiveFrom}
            onChange={(e) => setDraft((d) => ({ ...d, effectiveFrom: e.target.value }))}
          />
        </FormField>
        <PermissionButton permission="savings:settings" onClick={save} disabled={submitting}>
          {submitting ? "Adding…" : "Add rates"}
        </PermissionButton>
      </div>
      <p className="text-xs text-muted-foreground">
        Each day the whole balance earns the rate of the highest tier it reaches. List tiers from the lowest balance up.
        Rates added for a date replace any added earlier for the same date.
      </p>
    </div>
  );
}
