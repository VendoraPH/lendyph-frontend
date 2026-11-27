"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { PageFill } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/format";
import { issueCountsByRecord } from "@/lib/cic/records";
import { CIC_RECORD_ENDPOINTS, useCicRecords, type CicRecordSet } from "../_hooks/use-cic-records";
import { CicPageHeader } from "./page-header";
import { RecordTable, type CicRecordRow } from "./record-table";
import { ReferenceDateField } from "./reference-date-field";
import { useReferenceDate } from "./reference-date";

const RECORD_NAMES: Record<string, string> = {
  ID: "Individual",
  BD: "Business",
  CI: "Installment",
  CN: "Non-installment",
  CC: "Credit card",
};

function subjectRows(set: CicRecordSet): CicRecordRow[] {
  const counts = issueCountsByRecord(set.issues);
  return set.subjects.map((s, i) => ({
    key: `s${s.id}`,
    number: s.subject_no,
    name: s.name,
    kind: `${s.record_type} · ${RECORD_NAMES[s.record_type]}`,
    detail: `Member #${s.borrower_id}`,
    counts: counts.get(i),
  }));
}

function contractRows(set: CicRecordSet): CicRecordRow[] {
  const counts = issueCountsByRecord(set.issues);
  // Contracts follow the subjects in the file, so their issues are indexed after them.
  const offset = set.subjects.length;
  return set.contracts.map((c, i) => ({
    key: `c${c.id}`,
    number: c.loan_number ?? `Loan #${c.loan_id}`,
    name: c.borrower_name,
    kind: `${c.record_type} · ${RECORD_NAMES[c.record_type]}`,
    detail: `Subject ${c.subject_no}${c.contract_phase ? ` · phase ${c.contract_phase}` : ""}`,
    counts: counts.get(offset + i),
  }));
}

/** Subject Records and Contract Records: the same screen over a different half of the file. */
export function RecordsScreen({ kind }: { kind: "subjects" | "contracts" }) {
  const [referenceDate, setReferenceDate] = useReferenceDate();
  const resource = useCicRecords(referenceDate);
  const isSubjects = kind === "subjects";
  const rows = useMemo(
    () => (resource.data ? (isSubjects ? subjectRows(resource.data) : contractRows(resource.data)) : []),
    [resource.data, isSubjects],
  );

  return (
    <PageFill>
      <CicPageHeader
        title={isSubjects ? "Subject Records" : "Contract Records"}
        description={
          isSubjects
            ? "Each member (ID record) and business (BD record) as CIC will receive it."
            : "Each loan as a CIC contract record: installment (CI), non-installment (CN) or credit card (CC)."
        }
        actions={
          <>
            <ReferenceDateField value={referenceDate} onChange={setReferenceDate} max={todayISO()} />
            <Button variant="outline" nativeButton={false} render={<Link href="/cic/validation" />}>
              See Every Issue
            </Button>
          </>
        }
      />
      <DataState
        resource={resource}
        summary={
          isSubjects
            ? "Every member and business CIC will receive, checked field by field."
            : "Every loan CIC will receive, checked field by field."
        }
        endpoints={CIC_RECORD_ENDPOINTS}
        isEmpty={(set) => (isSubjects ? set.subjects.length === 0 : set.contracts.length === 0)}
        emptyMessage={isSubjects ? "No subject to report as of this date." : "No loan to report as of this date."}
      >
        {(set) => (
          <>
            {set.truncated && (
              <IncompleteListNotice
                shown={set.inputs.length}
                total={set.total}
                noun="records"
                consequence="Some records are missing from this list and were not checked."
              />
            )}
            <RecordTable rows={rows} numberLabel={isSubjects ? "Subject No" : "Contract No"} />
          </>
        )}
      </DataState>
    </PageFill>
  );
}
