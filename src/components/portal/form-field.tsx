import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/**
 * A label, its control and the field's message, tied together for screen
 * readers: the control gets `id`, and `aria-describedby` points at the hint
 * and the error (`<id>-hint`, `<id>-error`).
 */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** The `aria-*` a control inside `FormField` takes. */
export function fieldAria(id: string, error?: string, hint?: boolean) {
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return { "aria-invalid": error ? true : undefined, "aria-describedby": described || undefined };
}
