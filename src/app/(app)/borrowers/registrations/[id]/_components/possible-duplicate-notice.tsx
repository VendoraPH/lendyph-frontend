// src/app/(app)/borrowers/registrations/[id]/_components/possible-duplicate-notice.tsx
"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  possibleDuplicateHref,
  possibleDuplicateLabel,
  type PossibleDuplicate,
} from "../_lib/possible-duplicate";

interface Props {
  duplicate: PossibleDuplicate;
  /** Still to be decided: adds what to check before approving. */
  pending: boolean;
}

/**
 * The record the server linked this registration to as a possible duplicate:
 * its code and name, linking to it, when the server names it to this
 * reviewer; otherwise only the server's notice, which names nobody.
 */
export function PossibleDuplicateNotice({ duplicate, pending }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        {duplicate.visible ? (
          <>
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Possible duplicate of{" "}
              <Link
                href={possibleDuplicateHref(duplicate)}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {possibleDuplicateLabel(duplicate)}
              </Link>
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {duplicate.reason}.
              {duplicate.is_member ? "" : " That's another registration, not a member yet."}
              {pending ? " Check that this is a different person before approving." : ""}
            </p>
          </>
        ) : (
          <>
            <p className="font-medium text-amber-900 dark:text-amber-200">Possible duplicate</p>
            <p className="mt-0.5 text-muted-foreground">{duplicate.message}</p>
          </>
        )}
      </div>
    </div>
  );
}
