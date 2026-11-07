"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { IDENTIFIER_LABELS } from "@/lib/portal/labels";
import type { PortalLoginIdentifier } from "@/types/portal";

interface IdentifierFieldProps {
  allowed: PortalLoginIdentifier[];
  type: PortalLoginIdentifier;
  value: string;
  onType: (type: PortalLoginIdentifier) => void;
  onValue: (value: string) => void;
}

const INPUT: Record<PortalLoginIdentifier, { inputMode: "email" | "tel" | "text"; autoComplete: string }> = {
  email: { inputMode: "email", autoComplete: "email" },
  mobile: { inputMode: "tel", autoComplete: "tel" },
  membership_number: { inputMode: "text", autoComplete: "username" },
};

/** The "Sign in with" choice (only when the cooperative allows more than one) and the value. */
export function IdentifierField({ allowed, type, value, onType, onValue }: IdentifierFieldProps) {
  const choose = allowed.length > 1;
  return (
    <div className="space-y-2">
      {choose && (
        <>
          <Label htmlFor="identifier-type">Sign in with</Label>
          <NativeSelect
            id="identifier-type"
            className="w-full"
            value={type}
            onChange={(e) => onType(e.target.value as PortalLoginIdentifier)}
          >
            {allowed.map((id) => (
              <NativeSelectOption key={id} value={id}>
                {IDENTIFIER_LABELS[id]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </>
      )}
      <Label htmlFor="identifier" className={choose ? "sr-only" : undefined}>
        {IDENTIFIER_LABELS[type]}
      </Label>
      <Input
        id="identifier"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        placeholder={IDENTIFIER_LABELS[type]}
        {...INPUT[type]}
      />
    </div>
  );
}
