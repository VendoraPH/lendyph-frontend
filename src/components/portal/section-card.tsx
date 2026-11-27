import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";

/**
 * A titled card for one part of a member page. `fill` makes it take the height
 * left in its column at the `fit:` size, with its body a column too, so a
 * `ScrollBox` inside scrolls its long list while the title stays put.
 */
export function SectionCard({
  title,
  action,
  fill = false,
  className,
  contentClassName,
  children,
}: {
  title: string;
  action?: ReactNode;
  fill?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn(fill && FIT_CLASSES.section, className)}>
      <CardHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className={cn(fill && FIT_CLASSES.section, contentClassName)}>{children}</CardContent>
    </Card>
  );
}
