"use client";

import type { ReactNode } from "react";
import { AlertCircle, Construction, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { AccountingResource } from "@/hooks";

interface DataStateProps<T> {
  resource: AccountingResource<T>;
  /** Endpoints this screen needs, shown when they are not built yet. */
  endpoints: string[];
  /** What the screen would show, in the user's terms. */
  summary: string;
  /** True when the request succeeded but returned nothing. */
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  children: (data: T) => ReactNode;
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * The four states every accounting screen can be in, in one place.
 *
 * `unavailable` is separated from `error` on purpose. Until the backend lands
 * every one of these screens gets a 404, and rendering that as a red failure
 * would make a module that is merely unfinished look broken. One says "not
 * connected yet" and names what it is waiting on; the other says something
 * went wrong and offers a retry.
 */
export function DataState<T>({
  resource,
  endpoints,
  summary,
  isEmpty,
  emptyMessage = "Nothing to show for this selection.",
  children,
}: DataStateProps<T>) {
  const { data, loading, unavailable, error, refetch } = resource;

  if (loading) {
    return (
      <Panel>
        <Spinner className="h-6 w-6" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Panel>
    );
  }

  if (unavailable) {
    return (
      <Panel>
        <div className="rounded-full bg-muted p-3">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="max-w-lg space-y-1">
          <p className="font-medium">Not connected yet</p>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="w-full max-w-lg rounded-lg border bg-muted/40 p-3 text-left">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Waiting on
          </p>
          <ul className="space-y-1">
            {endpoints.map((endpoint) => (
              <li key={endpoint} className="font-mono text-xs text-muted-foreground">
                {endpoint}
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        <div className="rounded-full bg-destructive/10 p-3">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="max-w-lg space-y-1">
          <p className="font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      </Panel>
    );
  }

  if (data === null || (isEmpty && isEmpty(data))) {
    return (
      <Panel>
        <div className="rounded-full bg-muted p-3">
          <Inbox className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </Panel>
    );
  }

  return <>{children(data)}</>;
}
