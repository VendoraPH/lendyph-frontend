"use client";

import { useCallback, useId, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIsClient } from "@/hooks";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { ScrollBox } from "./page-fill";

export interface ExpandableCardProps {
  /** The card's heading; also the dialog's title. */
  title: string;
  /** A line under the title (a date, a caption), shown in the dialog too. */
  description?: ReactNode;
  /** Badges or buttons beside the expand button. They stay on the card. */
  actions?: ReactNode;
  /** True (default): the card takes the height left in its column at fit. */
  fill?: boolean;
  className?: string;
  /** Classes for the card's body (a `CardContent`, a size container). */
  contentClassName?: string;
  /** The body: usually a `ScrollBox` with a table, or a report preview. */
  children: ReactNode;
}

/** The node the body is rendered into; it is moved, never re-created. */
function createBodyHost(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  // Layout-transparent: the body behaves as a direct child of whichever slot holds it.
  host.style.display = "contents";
  return host;
}

/**
 * A card whose body can be opened full size in a dialog, for long tables and
 * report previews.
 *
 * The body is rendered once, through a portal into a host node that moves
 * between the card and the dialog, so it stays mounted: its state is kept and
 * nothing it fetched is fetched again. While the dialog is open the card's
 * body is empty. The dialog's body is a `ScrollBox`, so table headings stay
 * pinned there too. Esc and the close button close it, and focus returns to
 * the expand button (Base UI's trigger).
 *
 * The body sits outside the dialog in React's tree: a popup inside it (a
 * select, a menu, another dialog) works on the card but isn't nested in the
 * expanded dialog, so keep such controls in `actions` or outside the card.
 *
 *     <ExpandableCard title="Recent Transactions" actions={<Badge>Today</Badge>}>
 *       <ScrollBox>
 *         <Table>…</Table>
 *       </ScrollBox>
 *     </ExpandableCard>
 */
export function ExpandableCard({
  title,
  description,
  actions,
  fill = true,
  className,
  contentClassName,
  children,
}: ExpandableCardProps) {
  const isClient = useIsClient();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [host] = useState(createBodyHost);
  const [cardSlot, setCardSlot] = useState<HTMLDivElement | null>(null);
  const [dialogSlot, setDialogSlot] = useState<HTMLDivElement | null>(null);

  // The card's body slot. The host goes in as the slot mounts, before the
  // body's own layout effects run, so anything that measures itself on mount
  // (a chart) measures in place.
  const attachCardSlot = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && host && !host.parentNode) el.appendChild(host);
      setCardSlot(el);
    },
    [host],
  );

  // Moves between the card and the dialog, before paint, so the body never
  // shows in both places or in neither.
  useLayoutEffect(() => {
    if (!host) return;
    const slot = open && dialogSlot ? dialogSlot : cardSlot;
    if (slot && host.parentNode !== slot) slot.appendChild(host);
  }, [host, open, cardSlot, dialogSlot]);

  return (
    <Card className={cn(fill && FIT_CLASSES.section, className)}>
      <CardHeader>
        <CardTitle>
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction className="flex items-center gap-2">
          {actions}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Expand"
                  aria-describedby={titleId}
                  title="Expand"
                />
              }
            >
              <Maximize2 aria-hidden="true" />
            </DialogTrigger>
            <DialogContent size="full" className="overflow-hidden">
              <DialogHeader className="pr-10">
                <DialogTitle>{title}</DialogTitle>
                {description ? <DialogDescription>{description}</DialogDescription> : null}
              </DialogHeader>
              <ScrollBox always ref={setDialogSlot} className="@container" />
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>
      <CardContent
        ref={attachCardSlot}
        className={cn("@container", fill && FIT_CLASSES.section, contentClassName)}
      />
      {isClient && host ? createPortal(children, host) : null}
    </Card>
  );
}
