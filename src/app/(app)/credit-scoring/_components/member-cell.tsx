import Link from "next/link";
import { borrowerLabel } from "@/lib/credit-scoring/borrower-label";

/**
 * A member's name with their member code beneath it. The name links to the
 * member's credit profile, so a keyboard user can reach it from any list.
 */
export function MemberCell({
  row,
}: {
  row: { borrower_id: number; borrower_name?: string | null; borrower_code?: string | null };
}) {
  return (
    <div>
      <Link
        href={`/credit-scoring/borrowers/${row.borrower_id}`}
        className="font-medium hover:underline"
      >
        {borrowerLabel(row)}
      </Link>
      {row.borrower_code && <p className="text-xs text-muted-foreground">{row.borrower_code}</p>}
    </div>
  );
}
