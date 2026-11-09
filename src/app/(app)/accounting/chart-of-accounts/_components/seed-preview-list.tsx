import { Badge } from "@/components/ui/badge";
import type { SeedPreviewRow } from "../_lib/seed-template";

/**
 * The accounts a template will create, in code order. A cooperative's
 * additions carry a "Cooperative" badge so the difference from the lending
 * company chart shown on the page is visible before anything is written.
 */
export function SeedPreviewList({ rows }: { rows: SeedPreviewRow[] }) {
  return (
    <ul
      aria-label="Accounts this chart creates"
      className="max-h-72 divide-y overflow-y-auto rounded-md border text-sm"
    >
      {rows.map((row) => (
        <li
          key={row.code}
          className="flex items-center justify-between gap-3 px-3 py-1.5"
        >
          <span className={row.parent ? "pl-3" : "font-medium"}>
            <span className="tabular-nums text-muted-foreground">{row.code}</span>{" "}
            {row.name}
            {row.is_group && (
              <span className="text-muted-foreground"> (heading)</span>
            )}
          </span>
          {row.cooperative && <Badge variant="secondary">Cooperative</Badge>}
        </li>
      ))}
    </ul>
  );
}
