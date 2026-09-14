import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface AwaitingBackendProps {
  /** What this screen will do, in the user's terms. */
  summary: string;
  /** The endpoints it is waiting on, exactly as proposed in the handoff. */
  endpoints: string[];
}

/**
 * Shown by the accounting screens whose data has no endpoint behind it yet.
 *
 * The alternative was sample rows, and for a ledger that is worse than an
 * empty page: a screenshot of invented figures outlives the explanation that
 * they were invented. This says plainly that the screen is not live and names
 * what it is waiting for, so anyone who opens it knows where things stand.
 */
export function AwaitingBackend({ summary, endpoints }: AwaitingBackendProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
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
      </CardContent>
    </Card>
  );
}
