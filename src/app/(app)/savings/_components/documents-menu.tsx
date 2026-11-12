"use client";

import { useState } from "react";
import { ChevronDown, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SavingsDocument } from "@/lib/savings/documents";
import { printSavingsDocument } from "@/lib/savings/print-document";

/** A "Documents" menu that prints one savings document for this record in a new tab. */
export function DocumentsMenu({ documents, subjectId }: { documents: readonly SavingsDocument[]; subjectId: number }) {
  const [busy, setBusy] = useState(false);
  const print = (doc: SavingsDocument) => {
    setBusy(true);
    printSavingsDocument(doc, subjectId).then(() => setBusy(false));
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={busy} />}>
        <FileStack className="h-4 w-4" /> {busy ? "Preparing…" : "Documents"}
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {documents.map((doc) => (
          <DropdownMenuItem key={doc.id} onClick={() => print(doc)}>
            {doc.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
