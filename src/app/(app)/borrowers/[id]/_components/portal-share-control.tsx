"use client";

import { useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { portalAdminService } from "@/services/portal-admin.service";
import { notifyPortalError } from "@/app/(app)/member-portal/_lib/notify-portal-error";

export { sharedFromList } from "@/app/(app)/member-portal/_lib/document-share";

interface PortalShareControlProps {
  borrowerId: number;
  documentId: number;
  documentName: string;
  /**
   * Whether the file is shared now, when known: the server's answer to the
   * last share or unshare here, or the list's `portal_shared_at`. Unknown
   * (a backend that doesn't send it) offers both actions.
   */
  shared: boolean | undefined;
  onChanged: (shared: boolean) => void;
}

/**
 * "Share with member" on a member's file (member_portal:manage and
 * borrowers:view; the caller checks both). The member then sees and
 * downloads it in the portal after signing in, never by a link. Valid IDs and
 * co-maker files can't be shared: the server refuses them in words.
 */
export function PortalShareControl({ borrowerId, documentId, documentName, shared, onChanged }: PortalShareControlProps) {
  const { submitting, run } = useSubmitGuard();
  const [open, setOpen] = useState(false);

  const change = (share: boolean) =>
    run(() =>
      share
        ? portalAdminService.shareDocument(borrowerId, documentId)
        : portalAdminService.unshareDocument(borrowerId, documentId),
    )
      ?.then((result) => {
        onChanged(result.shared);
        notifySuccess(result.shared ? "Shared with the member in the portal" : "No longer shared with the member", documentName);
      })
      .catch((err: unknown) => notifyPortalError(err, "The file's sharing couldn't be changed."));

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {shared && (
        <Badge variant="outline" className="text-xs">
          Shared
        </Badge>
      )}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 w-7 p-0")}
          aria-label={`Member Portal sharing for ${documentName}`}
          disabled={submitting}
        >
          <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {shared !== true && <DropdownMenuItem onClick={() => change(true)}>Share with member</DropdownMenuItem>}
          {shared !== false && <DropdownMenuItem onClick={() => change(false)}>Stop sharing with member</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
