"use client";

import { PageFill } from "@/components/common/page-fill";
import { CicPageHeader } from "../_components/page-header";
import { IssueList } from "../_components/issue-list";
import { SourceField } from "../_components/source-field";
import { useCicSource } from "../_hooks/use-cic-source";
import { CicGuard } from "../_components/cic-guard";

function CicIssuesContent() {
  const { value, setValue, source, captures } = useCicSource();
  return (
    <PageFill>
      <CicPageHeader
        title="Issues"
        description="Every field CIC would refuse, as the server checks it against the 2016 CSDF layouts."
      />
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <SourceField value={value} onChange={setValue} captures={captures} />
      </div>
      <IssueList key={JSON.stringify(source)} source={source} />
    </PageFill>
  );
}

export default function CicIssuesPage() {
  return (
    <CicGuard permission="cic:view" pageName="Issues">
      <CicIssuesContent />
    </CicGuard>
  );
}
