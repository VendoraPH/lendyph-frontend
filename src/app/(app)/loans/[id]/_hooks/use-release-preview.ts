import { loanService } from "@/services/loan.service";
import type { LoanReleasePreview } from "@/types/loan";
import { usePreviewRead, type PreviewReadState } from "./use-preview-read";

export type ReleasePreviewState = PreviewReadState<LoanReleasePreview>;

const readReleasePreview = (loanId: number) => loanService.releasePreview(loanId);

/**
 * `GET /loans/{id}/release-preview`, read once each time `enabled` turns on and
 * again on `reload` (Try again, or after the release is refused because the fees
 * changed). The loan page shares the one answer between the release details card
 * and the Release dialog.
 */
export function useReleasePreview(loanId: number, enabled: boolean) {
  return usePreviewRead({
    read: readReleasePreview,
    failureMessage: "We couldn't load the release figures. Please try again.",
    loanId,
    enabled,
  });
}
