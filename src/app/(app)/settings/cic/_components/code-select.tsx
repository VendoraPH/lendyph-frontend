import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { CicCode } from "@/types/cic";

/** A CIC code list from the server, read as "code · label". */
export function CodeSelect({
  id,
  codes,
  value,
  onChange,
  empty,
  disabled,
  "aria-label": ariaLabel,
  className,
}: {
  id?: string;
  codes: CicCode[];
  value: string | null;
  onChange: (code: string | null) => void;
  /** The blank choice's words. */
  empty: string;
  disabled?: boolean;
  "aria-label": string;
  className?: string;
}) {
  return (
    <NativeSelect
      id={id}
      aria-label={ariaLabel}
      className={className ?? "w-full min-w-48"}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <NativeSelectOption value="">{empty}</NativeSelectOption>
      {codes.map((c) => (
        <NativeSelectOption key={c.code} value={c.code}>
          {c.code} · {c.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
