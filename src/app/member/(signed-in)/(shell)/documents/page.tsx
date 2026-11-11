"use client";

import { useCallback } from "react";
import { FileText } from "lucide-react";
import { DownloadButton } from "@/components/portal/download-button";
import { LoadState } from "@/components/portal/load-state";
import { PortalPageHeader } from "@/components/portal/page-header";
import { SectionCard } from "@/components/portal/section-card";
import { formatDate, todayISO } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { FILE_TYPE, GENERATED_DOCUMENT, labelOf } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import type { DownloadedFile } from "@/lib/portal/portal-client";
import type { GeneratedDocument } from "@/lib/portal/types";
import { fileSize } from "@/lib/portal/words";

/** The download a generated document stands for. */
function generatedDownload(doc: GeneratedDocument): (() => Promise<DownloadedFile>) | null {
  const today = todayISO();
  switch (doc.kind) {
    case "loan_statement":
      return doc.id === null ? null : () => portalService.loanStatement(doc.id as number);
    case "savings_statement":
      return doc.id === null ? null : () => portalService.savingsStatement(doc.id as number);
    case "time_deposit_certificate":
      return doc.id === null ? null : () => portalService.timeDepositCertificate(doc.id as number);
    case "share_capital_statement":
      return () => portalService.shareCapitalStatement(`${today.slice(0, 4)}-01-01`, today);
    case "share_capital_certificate":
      return () => portalService.shareCapitalCertificate(today);
    default:
      return null;
  }
}

/**
 * Generated documents (made by the server when asked) and the files the
 * branch shared with the member, downloaded through the signed-in portal,
 * never by a public link.
 */
export default function DocumentsPage() {
  const fetcher = useCallback(() => portalService.documents(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your documents. Please try again.");

  return (
    <>
      <PortalPageHeader title="Documents" />
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Statements and certificates">
              {data.generated.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing to generate yet.</p>
              ) : (
                <ul className="divide-y">
                  {data.generated.map((doc, index) => {
                    const download = generatedDownload(doc);
                    return (
                      <li key={`${doc.kind}-${doc.id ?? index}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{labelOf(GENERATED_DOCUMENT, doc.kind)}</p>
                          {doc.reference && <p className="text-xs text-muted-foreground">{doc.reference}</p>}
                        </div>
                        {download && (
                          <DownloadButton download={download} fileName={`${doc.kind}-${doc.reference ?? todayISO()}.pdf`}>
                            PDF
                          </DownloadButton>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted-foreground">The share capital statement here covers this year; pick other dates on the Share Capital page.</p>
            </SectionCard>
            <SectionCard title="Shared by your branch">
              {data.files.length === 0 ? (
                <p className="text-sm text-muted-foreground">Your branch hasn&apos;t shared any files with you.</p>
              ) : (
                <ul className="divide-y">
                  {data.files.map((file) => (
                    <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="flex min-w-0 items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-sm font-medium break-words">{file.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {labelOf(FILE_TYPE, file.category?.toLowerCase())} · {fileSize(file.size)}
                            {file.shared_on ? ` · Shared ${formatDate(file.shared_on)}` : ""}
                          </p>
                        </div>
                      </div>
                      <DownloadButton download={() => portalService.downloadDocument(file.id)} fileName={file.file_name ?? `document-${file.id}`}>
                        Download
                      </DownloadButton>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        )}
      </LoadState>
    </>
  );
}
