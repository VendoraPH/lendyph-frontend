"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadStateProps {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  /** True when the answer came back with nothing in it. */
  empty?: boolean;
  emptyText?: string;
  children: ReactNode;
}

/** Loading, refused, empty or the content: the four states of every member read. */
export function LoadState({ loading, error, onRetry, empty, emptyText = "Nothing to show yet.", children }: LoadStateProps) {
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <span className="sr-only">Loading</span>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-10 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
        <p className="max-w-md text-sm">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
        )}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-muted-foreground">
        <Inbox className="h-6 w-6" aria-hidden />
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }
  return <>{children}</>;
}
