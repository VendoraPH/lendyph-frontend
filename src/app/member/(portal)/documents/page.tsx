"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDate } from "@/lib/format";
import { TONE_CLASS } from "@/lib/portal/labels";
import { DOCUMENT_CATEGORIES, SIGNING_STATUS } from "@/lib/portal/requests";
import { portalService } from "@/services/portal.service";
import type { PortalDocument, PortalDocumentCategory } from "@/types/portal";
import { DownloadButton } from "../../_components/download-button";
import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader, StatusPill } from "../../_components/portal-shell";
import { ServiceOff } from "../../_components/service-off";

export default function MemberDocumentsPage() {
  const { config } = usePortalConfig();
  return (
    <>
      <PortalPageHeader
        title="Documents"
        description="Copies of the documents the cooperative has released to you: membership forms, loan papers, certificates and receipts."
      />
      {config.features.documents ? <DocumentList /> : <ServiceOff service="Documents" />}
    </>
  );
}

function DocumentList() {
  const fetcher = useCallback(() => portalService.documents(), []);
  const resource = useApiResource(fetcher);
  const [category, setCategory] = useState<PortalDocumentCategory | "all">("all");

  return (
    <DataState
      resource={resource}
      endpoints={["GET /portal/documents", "GET /portal/documents/{id}/download"]}
      summary="Your documents"
      isEmpty={(docs) => docs.length === 0}
      emptyMessage="No documents have been released to you yet."
    >
      {(docs) => <FilteredDocuments docs={docs} category={category} onCategory={setCategory} />}
    </DataState>
  );
}

function FilteredDocuments({
  docs,
  category,
  onCategory,
}: {
  docs: PortalDocument[];
  category: PortalDocumentCategory | "all";
  onCategory: (c: PortalDocumentCategory | "all") => void;
}) {
  const shown = useMemo(
    () => (category === "all" ? docs : docs.filter((d) => d.category === category)),
    [docs, category],
  );
  const present = useMemo(() => new Set(docs.map((d) => d.category)), [docs]);

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <NativeSelect
          aria-label="Category"
          value={category}
          onChange={(e) => onCategory(e.target.value as PortalDocumentCategory | "all")}
        >
          <NativeSelectOption value="all">All categories</NativeSelectOption>
          {(Object.keys(DOCUMENT_CATEGORIES) as PortalDocumentCategory[])
            .filter((c) => present.has(c))
            .map((c) => (
              <NativeSelectOption key={c} value={c}>
                {DOCUMENT_CATEGORIES[c]}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </div>
      <Card>
        <CardContent className="divide-y p-0">
          {shown.map((doc) => {
            const signing = SIGNING_STATUS[doc.signing_status];
            return (
              <div key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOCUMENT_CATEGORIES[doc.category] ?? doc.category}
                    {doc.reference && ` · ${doc.reference}`}{doc.issued_at && ` · Issued ${formatDate(doc.issued_at)}`}
                  </p>
                </div>
                {signing && <StatusPill className={TONE_CLASS[signing.tone]}>{signing.label}</StatusPill>}
                <DownloadButton
                  variant="ghost"
                  label="Download"
                  filename={doc.file_name || `document-${doc.id}.pdf`}
                  fetchFile={() => portalService.downloadDocument(doc.id)}
                />
              </div>
            );
          })}
          {shown.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No documents in this category.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
