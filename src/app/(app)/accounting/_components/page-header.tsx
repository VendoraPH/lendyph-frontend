import type { ReactNode } from "react";

interface AccountingPageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

/**
 * Thirteen accounting pages share one header. Kept here rather than in
 * `src/components` because nothing outside this module uses it — if a
 * fourteenth caller appears elsewhere, that is the moment to promote it.
 */
export function AccountingPageHeader({
  title,
  description,
  actions,
}: AccountingPageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actions}
    </div>
  );
}
