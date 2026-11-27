import type { ReactNode } from "react";

/**
 * The heading every signed-in member page starts with (carried over from #511
 * by Augustin). It keeps its height inside `PageFill`; the page's gap spaces it.
 */
export function PortalPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold break-words sm:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
