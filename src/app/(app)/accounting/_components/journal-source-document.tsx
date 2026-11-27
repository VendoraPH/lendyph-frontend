"use client";

/**
 * The Reference cell, on the register and the journal page.
 *
 * `reference` and the `postable_*` trio are the same idea at two fidelities: a
 * string the poster wrote down, and a resolvable pointer at the row it came
 * from. They are shown together rather than in two columns — a loan release
 * whose reference is already "LN-000154" would otherwise print it twice.
 *
 * Whether a link is offered at all is decided in
 * {@link sourceDocument}, not here: only some kinds have a page to open.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sourceDocument } from "@/lib/accounting/source-document";
import type { JournalEntry } from "@/types";

/**
 * Reference text plus, when the document can be opened, a link to it.
 *
 * The reference string stays the cell's headline because that is what the
 * column has always shown. The source document supplies what it could not: the
 * way through, and a name for the entries that have no reference at all.
 */
export function JournalReferenceCell({ entry }: { entry: JournalEntry }) {
  const doc = sourceDocument(entry);
  const text = entry.reference || doc?.text || "—";
  // The column is monospaced because it holds identifiers. "Expense payment
  // #9" is a name standing in for one, and reads badly in mono.
  const prose = !entry.reference && doc ? "font-sans" : undefined;

  if (!doc?.href) {
    return <span className={cn("block truncate", prose)}>{text}</span>;
  }

  return (
    <div className="flex items-center gap-0.5">
      <span
        className={cn("min-w-0 truncate", prose)}
        // Only when it adds something: a reference of "COL-10254" does not say
        // which receipt it is.
        title={doc.text === text ? undefined : doc.text}
      >
        {text}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        nativeButton={false}
        render={<Link href={doc.href} />}
        // The whole register row opens the journal page. Without this,
        // following the link would also open the journal behind it.
        onClick={(event) => event.stopPropagation()}
        aria-label={`Open ${doc.text}`}
        title={`Open ${doc.text}`}
      >
        <ArrowUpRight />
      </Button>
    </div>
  );
}
