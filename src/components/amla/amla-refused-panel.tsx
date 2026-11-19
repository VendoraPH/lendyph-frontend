import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

/** A record the server refused (404 or 403), in words, with the way back to its list. */
export function AmlaRefusedPanel({ refused, message, backHref, backLabel }: { refused: "not_found" | "no_access"; message: string; backHref: string; backLabel: string }) {
  return (
    <Card className="shrink-0">
      <CardContent className="space-y-2 py-10 text-center" role="alert">
        <p className="font-medium">{refused === "not_found" ? "Not found" : "No access"}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link href={backHref} className="text-sm underline-offset-4 hover:underline">
          {backLabel}
        </Link>
      </CardContent>
    </Card>
  );
}
