import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Add to a grid of `FormField`s so their controls line up when one label
 * wraps: each field spans three of the grid's rows (label, control, hint or
 * error) through a subgrid, and a short label sits at the foot of its row.
 * Every direct child of the grid must be a `FormField`.
 */
export const ALIGNED_FIELDS =
  "[&>[data-slot=form-field]]:row-span-3 [&>[data-slot=form-field]]:grid [&>[data-slot=form-field]]:grid-rows-subgrid [&>[data-slot=form-field]>:first-child]:self-end";

/**
 * A labelled form row with an optional hint or error underneath. A column with
 * a gap, not `space-y-*`: a select puts a hidden input after its trigger, which
 * would take the spacing. The control (with anything shown beside it) is one
 * block, so `ALIGNED_FIELDS` can line the rows up. `field` is the error key a
 * stepper focuses on (`data-field`), when it differs from `id`.
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
    <div data-slot="form-field" data-field={field} className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
