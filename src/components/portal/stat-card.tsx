import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  /** The card's main figure, already in words or as `<Money>`. */
  value: ReactNode;
  /** Smaller lines under it. */
  lines?: { label: string; value: ReactNode }[];
  href?: string;
  linkText?: string;
}

/** One figure the dashboard leads with, linking to its page. */
export function StatCard({ title, value, lines = [], href, linkText = "View" }: StatCardProps) {
  return (
    <Card size="sm">
      <CardContent className="flex h-full flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-semibold">{value}</p>
        {lines.length > 0 && (
          <dl className="space-y-1 text-xs">
            {lines.map((line) => (
              <div key={line.label} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className="text-right">{line.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {href && (
          <Link href={href} className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary hover:underline">
            {linkText}
            <span className="sr-only"> {title}</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
