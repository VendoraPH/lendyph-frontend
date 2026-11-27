import type { ReactNode } from "react";
import { Icon3D } from "@/components/common/icon-3d";

interface CicPageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function CicPageHeader({ title, description, actions }: CicPageHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon3D name="empty-compliance" size={40} className="hidden sm:block" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
