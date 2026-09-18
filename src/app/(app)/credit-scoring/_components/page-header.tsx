import type { ReactNode } from "react";

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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
