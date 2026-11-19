"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AMLA_CHANNEL_OPTIONS, amlaSettingRow, type AmlaSettingDraft } from "@/lib/amla/settings-view";
import type { AmlaSetting } from "@/types/amla";

const UNIT_HINT: Readonly<Record<string, string>> = {
  peso: "In pesos, up to two decimals.",
  working_days: "Working days.",
  years: "Years.",
};

interface Props {
  setting: AmlaSetting;
  draft: AmlaSettingDraft | undefined;
  disabled: boolean;
  onChange: (next: AmlaSettingDraft) => void;
}

/** One setting in the change form: its new value, and confirming it or marking it to verify again. */
export function AmlaSettingField({ setting, draft, disabled, onChange }: Props) {
  if (!draft) return null;
  const id = `amla-setting-${setting.key}`;
  const now = amlaSettingRow(setting);

  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{setting.label}</legend>
      <p className="text-xs text-muted-foreground">
        In force: {now.value} · {now.check}
      </p>

      {setting.unit === "channels" ? (
        <div role="group" aria-label={setting.label} className="flex flex-wrap gap-x-4 gap-y-2">
          {AMLA_CHANNEL_OPTIONS.map((option) => {
            const checked = draft.channels.includes(option.value);
            return (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(on) =>
                    onChange({
                      ...draft,
                      channels: on ? [...draft.channels, option.value] : draft.channels.filter((c) => c !== option.value),
                    })
                  }
                />
                {option.label}
              </label>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          <Label htmlFor={id}>New value</Label>
          <Input
            id={id}
            inputMode={setting.unit === "peso" ? "decimal" : "numeric"}
            value={draft.value}
            disabled={disabled}
            className="max-w-xs"
            aria-describedby={`${id}-hint`}
            onChange={(e) => onChange({ ...draft, value: e.target.value })}
          />
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {UNIT_HINT[setting.unit]}
          </p>
        </div>
      )}

      {setting.to_verify ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={draft.check === "confirm"}
              disabled={disabled}
              onCheckedChange={(on) => onChange({ ...draft, check: on ? "confirm" : "keep" })}
            />
            Confirmed
          </label>
          {draft.check === "confirm" && (
            <div className="space-y-1">
              <Label htmlFor={`${id}-source`}>What confirmed it</Label>
              <Input
                id={`${id}-source`}
                value={draft.source}
                maxLength={255}
                disabled={disabled}
                placeholder="The issuance, advisory or counsel's opinion"
                onChange={(e) => onChange({ ...draft, source: e.target.value })}
              />
            </div>
          )}
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={draft.check === "to_verify"}
            disabled={disabled}
            onCheckedChange={(on) => onChange({ ...draft, check: on ? "to_verify" : "keep" })}
          />
          Mark as to verify again
        </label>
      )}
    </fieldset>
  );
}
