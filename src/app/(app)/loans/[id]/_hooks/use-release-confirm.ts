import { useCallback, useEffect, useRef } from "react";
import type { ReleasePreviewInsuranceQuery } from "@/services/loan.service";
import {
  releaseConfirmView,
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
 * Which one is out of date cannot be told from here, so both are read again,
 * once per mismatched pair of fingerprints: a pair that survives the re-read is
 * left for `reread` (the dialog's Try again) rather than asked about forever.
 */
export function useReleaseConfirm({
  base,
  query,
  insurance,
  reloadBase,
  retryInsurance,
}: {
  base: ReleasePreviewState;
  query: ReleasePreviewInsuranceQuery | null;
  insurance: ReleaseInsuranceView;
  reloadBase: () => void;
  retryInsurance: () => void;
}): { view: ReleaseConfirmView; reread: () => void } {
  const basePreview = base.status === "loaded" ? base.preview : null;
  const view = releaseConfirmView(basePreview, query, insurance);
  const mismatch =
    view.status === "stale" && basePreview !== null && insurance.status === "ready"
      ? `${basePreview.fee_fingerprint}|${insurance.preview.fee_fingerprint}`
      : null;

  const reread = useCallback(() => {
    reloadBase();
    retryInsurance();
  }, [reloadBase, retryInsurance]);

  const rereadFor = useRef<string | null>(null);
  useEffect(() => {
    if (mismatch === null || mismatch === rereadFor.current) return;
    rereadFor.current = mismatch;
    reread();
  }, [mismatch, reread]);

  return { view, reread };
}
