"use client";

import Link from "next/link";
import { documentsCountLabel, registerDocumentsHref, type RegisterDocumentSubject } from "../_lib/register-documents";

/**
 * A register row's attached documents: the server's `documents_count`, linked
 * to the documents list filtered to that row. Nothing when the server sent no
 * count; plain words when there are none.
 */
export function RegisterDocumentsLink({
  subject,
  year,
  count,
  name,
}: {
  subject: RegisterDocumentSubject;
  year: number;
  count: number | undefined;
  /** How the row reads ("Basic cooperative course"), for screen readers. */
  name: string;
}) {
  const label = documentsCountLabel(count);
  if (label === null) return null;
  if (count === 0) return <span className="px-1 text-xs text-muted-foreground">{label}</span>;
  return (
    <Link
      href={registerDocumentsHref(subject, year)}
      className="px-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
      aria-label={`${label} attached to ${name}`}
    >
      {label}
    </Link>
  );
}
