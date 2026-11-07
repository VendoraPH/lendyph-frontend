"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PortalFeatures } from "@/types/portal";

export function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  min,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
      />
    </div>
  );
}

type BoolFeature = Exclude<keyof PortalFeatures, "credit_score">;

const FEATURE_LABELS: Record<BoolFeature, string> = {
  share_capital: "Share capital",
  savings: "Savings",
  time_deposits: "Time deposits",
  loans: "Loans",
  statements: "Statements",
  documents: "Documents",
  loan_applications: "Online loan applications",
  withdrawal_requests: "Withdrawal requests",
  profile_updates: "Profile change requests",
  gcash_payments: "GCash payments",
};

/** One switch per member service; switching one off hides it in the portal. */
export function FeatureSwitches({
  features,
  onChange,
}: {
  features: PortalFeatures;
  onChange: (f: PortalFeatures) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(FEATURE_LABELS) as BoolFeature[]).map((key) => (
        <SwitchRow
          key={key}
          id={`feature-${key}`}
          label={FEATURE_LABELS[key]}
          checked={features[key]}
          onChange={(v) => onChange({ ...features, [key]: v })}
        />
      ))}
    </div>
  );
}
