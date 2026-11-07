import { AlertTriangle } from "lucide-react";
import type { ApiResource } from "@/hooks/use-api-resource";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Borrower } from "@/types";

/** The chosen member's name, code, contact and branch, from their record. */
export function MemberCard({ member }: { member: ApiResource<Borrower | null> }) {
  const { data, loading, error } = member;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Member</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {loading && <Skeleton className="h-16 w-full" />}
        {!loading && error && <p className="text-destructive">We couldn&apos;t load this member.</p>}
        {!loading && data && (
          <>
            <dl className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="font-medium">{data.full_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Member code</dt>
                <dd className="font-mono">{data.borrower_code}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Contact</dt>
                <dd>{data.contact_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Branch</dt>
                <dd>{data.branch?.name ?? "—"}</dd>
              </div>
            </dl>
            {data.status !== "active" && (
              <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This member is {data.status}. Opening is refused unless savings settings allow inactive members.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
