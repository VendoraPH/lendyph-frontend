import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "../_lib/account-status";

const TONE_CLASS: Record<BadgeTone, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  muted: "bg-muted text-muted-foreground",
};

/** A status pill in one of the module's tones (account and transaction statuses). */
export function ToneBadge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return <Badge className={cn("border-transparent", TONE_CLASS[tone], className)}>{children}</Badge>;
}
