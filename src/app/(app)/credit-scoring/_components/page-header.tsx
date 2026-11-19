import type { ReactNode } from "react";
import { Icon3D } from "@/components/common/icon-3d";

interface CreditScoringPageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

/**
 * Local to this module, not shared with accounting's page-header — mirrors
 * that file's own note: promote only when a third module needs the same
 * shape, not preemptively.
 */
export function CreditScoringPageHeader({ title, description, actions }: CreditScoringPageHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon3D name="icon-credit-score" size={40} className="hidden sm:block" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
