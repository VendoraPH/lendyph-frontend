import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled form row with an optional hint or error underneath. A column with
 * a gap, not `space-y-*`: a select puts a hidden input after its trigger, which
 * would take the spacing. `field` is the error key a stepper focuses on
 * (`data-field`), when it differs from `id`.
 */
export function FormField({
  id,
  field,
  label,
  hint,
  error,
  className,
  children,
}: {
  id?: string;
  field?: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-field={field} className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
