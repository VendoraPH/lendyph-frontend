"use client";

import Link from "next/link";
import { ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { CHART_NOT_SET_UP_TITLE, CHART_OF_ACCOUNTS_HREF } from "@/lib/accounting/chart-status";
import { cn } from "@/lib/utils";

interface ChartNotSetUpProps {
  /** What this screen needs the chart for, in one sentence. */
  description: string;
  className?: string;
}

/**
 * Shown in place of a screen that reads or posts to accounts while the
 * organisation has no saved chart (`useChartOfAccounts().status` is
 * `not_set_up`), so nobody picks a template account the server doesn't have.
 */
export function ChartNotSetUp({ description, className }: ChartNotSetUpProps) {
  return (
    <Empty className={cn("border", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ListTree aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{CHART_NOT_SET_UP_TITLE}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button nativeButton={false} render={<Link href={CHART_OF_ACCOUNTS_HREF} />}>
          Go to Chart of Accounts
        </Button>
      </EmptyContent>
    </Empty>
  );
}
