import { useCallback, useState } from "react";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import type { ReleasePreviewInsuranceQuery } from "@/services/loan.service";
import {
  releaseConfirmView,
  staleReread,
  type ReleaseConfirmView,
  type ReleaseInsuranceView,
} from "../_lib/release-figures";
import type { ReleasePreviewState } from "./use-release-preview";

/**
 * The server answer the Release dialog may confirm against
 * (`releaseConfirmView`), and the re-read that brings the two previews back
 * together when they were read against different fees.
 *
 * A mismatch means the fees changed between the release preview (the fee list
 * on screen) and the insurance preview (the net and the fingerprint sent).
 * Both are read again, once per mismatched pair (`staleReread`). `stuck` is a
 * pair that survived that re-read: the dialog then asks the cashier to use
 * Try again (`reread`) rather than re-reading forever. The remembered pair is
 * forgotten each time the dialog opens.
 *
 * The re-read is started during render, as `useReleasePreview` starts its own
 * read: the previews turn to loading in the same pass, so the mismatch is
 * never painted.
 */
export function useReleaseConfirm({
  open,
  base,
  query,
  insurance,
  reloadBase,
  retryInsurance,
}: {
  open: boolean;
  base: ReleasePreviewState;
  query: ReleasePreviewInsuranceQuery | null;
  insurance: ReleaseInsuranceView;
  reloadBase: () => void;
  retryInsurance: () => void;
}): { view: ReleaseConfirmView; stuck: boolean; reread: () => void } {
  const [rereadFor, setRereadFor] = useState<string | null>(null);
  if (useDialogOpening(open, true) && rereadFor !== null) setRereadFor(null);

  const basePreview = base.status === "loaded" ? base.preview : null;
  const view = releaseConfirmView(basePreview, query, insurance);
  const stale = staleReread(view, basePreview, insurance, rereadFor);

  const reread = useCallback(() => {
    reloadBase();
    retryInsurance();
  }, [reloadBase, retryInsurance]);

  if (stale.reread) {
    setRereadFor(stale.pair);
    reread();
  }

  return { view, stuck: stale.stuck, reread };
}
