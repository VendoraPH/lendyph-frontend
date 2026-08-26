"use client";

import type { VariantProps } from "class-variance-authority";
import { ChevronDown, Loader2, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePrintables } from "@/hooks";
import type { PrintableId } from "@/lib/printables/types";

/**
 * One Print button, offering the catalog documents that apply to whatever the
 * page is about — a loan, a member.
 *
 * Contextual because that is where the work happens: staff have the loan open
 * already, and sending them to `/printables` to re-pick it is the reason the
 * loan page grew its own bespoke document code in the first place. The catalog
 * stays the single definition of every printable; this only chooses which
 * entries to show and for which subject.
 */

interface PrintableMenuProps {
  /** Id of the loan / member / payment the documents are about. */
  subjectId: number;
  /** Catalog ids to offer, in the order they should appear. */
  ids: PrintableId[];
  /**
   * Why an entry cannot be printed yet, keyed by id.
   *
   * The entry is shown disabled with this reason in place of its description
   * rather than hidden: a demand letter missing from the menu reads as a bug,
   * while "Available once the loan falls past due" answers the question.
   */
  unavailable?: Partial<Record<PrintableId, string>>;
  label?: string;
  align?: "start" | "center" | "end";
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}

export function PrintableMenu({
  subjectId,
  ids,
  unavailable,
  label = "Print",
  align = "end",
  variant = "outline",
  size,
  className,
}: PrintableMenuProps) {
  const printables = usePrintables();
  const entries = printables.menu(ids);

  if (entries.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant}
            size={size}
            className={className}
            disabled={printables.isPreparing}
            aria-label={`${label} a document`}
          />
        }
      >
        {printables.isPreparing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Printer className="mr-2 h-4 w-4" />
        )}
        {printables.isPreparing ? "Preparing…" : label}
        <ChevronDown className="ml-2 h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Print…</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {entries.map((printable) => {
            const Icon = printable.icon;
            const reason = unavailable?.[printable.id] ?? null;
            return (
              <DropdownMenuItem
                key={printable.id}
                onClick={() => printables.open(printable.id, subjectId)}
                disabled={printables.isPreparing || reason !== null}
                className="flex items-start gap-3 py-2"
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{printable.title}</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {reason ?? printable.description}
                  </p>
                </div>
                {printables.pendingId === printable.id && (
                  <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
