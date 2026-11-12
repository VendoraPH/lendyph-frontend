import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { env } from "@/config/env";
import { usePermission } from "@/hooks";
import type { AccountingDashboard } from "@/types";
import { SAVINGS_GL_CONTROL_HREF, savingsGlBanner } from "../../_lib/dashboard-savings-gl";

/**
 * The savings GL warning (the Savings task's TASK 62), shown only when the
 * server says the savings subledger and GL 2050 or 2060 differ. The link opens
 * the GL control report for users who can read it.
 */
export function SavingsGlBannerCard({ data }: { data: AccountingDashboard }) {
  const { can } = usePermission();
  const banner = savingsGlBanner(data);
  if (!banner) return null;
  const canOpenReport = env.features.savings && can("reports:view") && can("savings:view");

  return (
    <Card className="border-2 border-amber-500/60" role="alert">
      <CardContent className="flex flex-wrap items-center gap-3 py-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{banner.message}</p>
          {banner.detail && <p className="text-sm text-muted-foreground">{banner.detail}</p>}
        </div>
        {canOpenReport && (
          <Link
            href={SAVINGS_GL_CONTROL_HREF}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open the Savings GL Control
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
