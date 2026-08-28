import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  shareCapitalUnavailableReason,
  type ShareCapitalBalance,
} from "@/utils/share-capital";

/**
 * Deliberately NOT re-exported from `@/components/common` — import it directly:
 *
 *     import { ShareCapitalUnavailableNotice } from "@/components/common/share-capital-unavailable-notice";
 *
 * That barrel is not tree-shaken and is imported by nearly every route for
 * `RouteGuard`; see the note in its index.ts. This one pulls
 * `@/utils/share-capital`, and through it the share capital service.
 */
export interface ShareCapitalUnavailableNoticeProps {
  /**
   * The refusal to explain. Passing an `ok` result renders nothing, so callers
   * can hand this the balance unconditionally instead of guarding at every use.
   */
  result: ShareCapitalBalance | null;
  /**
   * How many members are affected. Only meaningful on the screens that read
   * several ledgers at once (the collateral listing); omit it for the
   * single-member screens.
   */
  memberCount?: number;
  /**
   * What the operator will actually notice on THIS screen, in one sentence —
   * "the submit button is disabled", "these rows are left out of the total".
   * Required for the same reason `IncompleteListNotice` requires it:
   * "unavailable" is abstract and the consequence is not.
   */
  consequence: string;
  className?: string;
}

/**
 * The banner a screen shows when it will not state a share capital balance.
 *
 * Sibling to `IncompleteListNotice` and deliberately identical in appearance —
 * both mean "something on this screen is missing and we are telling you rather
 * than papering over it". It is a separate component because the two say
 * different things: that one reports a list that is short by a countable number
 * of rows, this one reports a FIGURE that has no trustworthy value at all.
 * Forcing this through `shown`/`total` would have meant inventing a row count
 * for the failure case, and the whole point is that there is no number.
 *
 * The wording lives here rather than at the three call sites so the collateral
 * listing, the collateral form and a member's collaterals tab cannot drift into
 * describing the same condition three different ways.
 *
 * `role="alert"` so a screen reader announces it when it appears mid-load,
 * rather than leaving it to be discovered by sighted scanning alone.
 */
export function ShareCapitalUnavailableNotice({
  result,
  memberCount,
  consequence,
  className,
}: ShareCapitalUnavailableNoticeProps) {
  if (!result || result.status === "ok") return null;

  const heading =
    memberCount !== undefined && memberCount > 1
      ? `${memberCount} members' share capital ledgers could not be read in full`
      : "This member's share capital balance could not be read";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4",
        className,
      )}
    >
      <AlertTriangle
        className="mt-0.5 size-5 shrink-0 text-amber-600"
        aria-hidden="true"
      />
      <div className="text-sm">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          {heading}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {shareCapitalUnavailableReason(result)} {consequence}
        </p>
      </div>
    </div>
  );
}
