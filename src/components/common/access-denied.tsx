"use client";

import { useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";

import { usePermission } from "@/hooks";
import { ROLES } from "@/constants/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AccessDeniedProps {
  pageName?: string;
}

export function AccessDenied({ pageName = "this page" }: AccessDeniedProps) {
  const router = useRouter();
  const { role, permissions } = usePermission();

  const roleConfig = role ? ROLES[role] : null;
  const roleLabel = roleConfig?.label ?? "Unknown";

  const accessibleModules = permissions
    .filter((p) => p.endsWith(":view"))
    .map((p) => {
      const moduleName = p.split(":")[0];
      return moduleName
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    });

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-6 rounded-full bg-destructive/10 p-4">
          <ShieldX className="size-12 text-destructive" />
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Access Restricted
        </h1>
        <p className="mb-6 text-muted-foreground">
          You don&apos;t have permission to view {pageName}.
        </p>

        <div className="mb-8 w-full rounded-lg border bg-muted/30 p-4 text-left text-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium text-muted-foreground">Role</span>
            <Badge variant="secondary">{roleLabel}</Badge>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">
              Accessible modules
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {accessibleModules.length > 0 ? (
                accessibleModules.map((module) => (
                  <Badge key={module} variant="outline">
                    {module}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">
                  No modules available
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            onClick={() => router.push("/dashboard")}
          >
            Go to Dashboard
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          If you think this is a mistake, contact your administrator.
        </p>
      </div>
    </div>
  );
}
