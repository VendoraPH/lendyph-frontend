"use client";

import type { ComponentProps } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DataState } from "../../_components/data-state";

type StatementStateProps<T> = ComponentProps<typeof DataState<T>> & {
  /** The server's message when it refused the request (422). */
  refusal: string | null;
};

/**
 * The statements' loading, empty, error and success states. A refusal (422)
 * shows the server's own message, never the generic failure panel.
 */
export function StatementState<T>({ refusal, ...props }: StatementStateProps<T>) {
  if (refusal !== null) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="rounded-full bg-amber-500/10 p-3">
            <AlertTriangle aria-hidden="true" className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="max-w-lg space-y-1" role="alert">
            <p className="font-medium">This statement can&apos;t be shown for this selection</p>
            <p className="text-sm text-muted-foreground">{refusal}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return <DataState {...props} />;
}
