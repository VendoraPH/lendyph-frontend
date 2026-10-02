import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrencyExact } from "@/lib/format";
import type { ReleasePreviewState } from "../_hooks/use-release-preview";

interface Props {
  preview: ReleasePreviewState;
  onRetry: () => void;
}

/**
 * The fees the release will withhold, as the server's release preview lists
 * them: the ones recorded on the loan and every configured fee that applies.
 * Nothing here is worked out in the browser.
 */
export function ReleaseDeductions({ preview, onRetry }: Props) {
  return (
    <section
      className="space-y-2"
      aria-labelledby="release-deductions-title"
      aria-busy={preview.status === "loading"}
    >
      <h3 id="release-deductions-title" className="text-sm font-medium">Fee deductions</h3>
      <p className="text-xs text-muted-foreground">
        What the release will withhold: the fees recorded on this loan and every fee
        configured in Settings that applies to it. Insurance is shown separately below.
      </p>
      {preview.status === "loading" && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Getting the release figures…
        </div>
      )}
      {preview.status === "failed" && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <p className="text-sm text-destructive">{preview.message}</p>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
      {preview.status === "loaded" && (
        <>
          {preview.preview.deductions.length === 0 && (
            <p className="text-sm text-muted-foreground">No fees will be withheld.</p>
          )}
          <dl className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
            {preview.preview.deductions.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex justify-between gap-4">
                <dt>
                  {item.name}
                  {item.fee_id != null && (
                    <span className="ml-1.5 text-xs text-muted-foreground">from Fees settings</span>
                  )}
                </dt>
                <dd className="tabular-nums shrink-0">{formatCurrencyExact(item.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-2 font-medium">
              <dt>Total fee deductions</dt>
              <dd className="tabular-nums">{formatCurrencyExact(preview.preview.total_deductions)}</dd>
            </div>
          </dl>
          {(preview.preview.overlap_warnings ?? []).map((warning) => (
            <p key={warning.fee_id} className="flex items-start gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {warning.message}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
