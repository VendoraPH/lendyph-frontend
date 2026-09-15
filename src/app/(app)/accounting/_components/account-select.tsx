"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account } from "@/types";

interface AccountSelectProps {
  label?: string;
  accounts: Account[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Account picker. Offers postable accounts only — group headings are filtered
 * out by the caller, because posting to a parent double-counts its children.
 */
export function AccountSelect({
  label,
  accounts,
  value,
  onChange,
  placeholder = "Select an account",
  className = "w-[300px]",
}: AccountSelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Select
        value={value === null ? "" : String(value)}
        onValueChange={(v) => onChange(v ? Number(v) : null)}
      >
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={String(account.id)}>
              <span className="font-mono text-xs">{account.code}</span>
              <span className="ml-2">{account.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
