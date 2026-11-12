import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SavingsDashboardKpis } from "@/types/savings-insight";
import { glNotice } from "../_lib/dashboard-view";

/**
 * The savings subledger against the books (the Savings task's TASK 62), first
 * on the page: when they differ, no other figure here can be relied on.
 */
export function GlControlNotice({ kpis, canOpenReport }: { kpis: SavingsDashboardKpis; canOpenReport: boolean }) {
  const notice = glNotice(kpis);
  if (!notice) return null;
  const warning = notice.tone === "warning";
  const Icon = warning ? AlertTriangle : CheckCircle2;

  return (
    <Card
      className={cn("border-2", warning ? "border-amber-500/60" : "border-emerald-500/40")}
      role={warning ? "alert" : "status"}
    >
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <Icon
          className={cn("h-5 w-5 shrink-0", warning ? "text-amber-600" : "text-emerald-600")}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{notice.message}</p>
          {notice.productNote && <p className="text-sm text-muted-foreground">{notice.productNote}</p>}
        </div>
        {warning && canOpenReport && (
          <Link href="/reports/savings_gl_control" className="text-sm font-medium text-primary hover:underline">
            Open the Savings GL Control
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
