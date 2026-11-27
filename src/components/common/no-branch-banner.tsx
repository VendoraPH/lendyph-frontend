"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { lacksBranchAccess } from "@/lib/user-branches";
import { useAuthStore } from "@/store";

/**
 * Deliberately NOT re-exported from `@/components/common`; import it directly:
 *
 *     import { NoBranchBanner } from "@/components/common/no-branch-banner";
 *
 * Same reason as `ShareCapitalUnavailableNotice`: that barrel is loaded by
 * nearly every route for `RouteGuard`.
 */
export interface NoBranchBannerProps {
  className?: string;
}

/**
 * Tells a user why their lists are empty when the API will show them no branch
 * data at all: they are assigned to no branch and do not hold
 * `branches:view_all` (App\Services\BranchAccess). Without it, an empty
 * dashboard or loan list reads as "nothing has been recorded yet".
 *
 * Renders nothing for everyone else, and before the signed-in user is known,
 * so a page can mount it unconditionally.
 *
 * `role="status"`, not `alert`: it describes the account, not something that
 * just went wrong, and it should not interrupt a screen reader mid-page.
 */
export function NoBranchBanner({ className }: NoBranchBannerProps) {
  const user = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));

  if (!lacksBranchAccess(user, viewAll)) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        No branch is assigned to your account. Ask an administrator to assign one.
      </p>
    </div>
  );
}
