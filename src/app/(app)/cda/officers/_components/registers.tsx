"use client";

import { useCallback, useMemo } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks";
import { cdaService, type CdaTrainingInput } from "@/services/cda.service";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaOfficer, CdaTraining } from "@/types/cda";
import { RegisterTable, type RegisterColumn } from "../../_components/register-table";
import { AttachButton, useAttachDocument } from "../../_components/attach-document";
import { CDA_FILE_ACCEPT } from "../../_components/record-form-dialog";
import { ToneBadge } from "../../_components/tone-badge";
import {
  OFFICER_STATUS_LABELS,
  POSITION_LABELS,
  SEX_LABELS,
  TRAINING_COMPLIANCE_META,
  TRAINING_STATUS_LABELS,
  labelOf,
  toOptions,
  trainingKeyLabel,
} from "../../_lib/labels";
import { asSent } from "../../_lib/money";
import type { RecordField, RecordValues } from "../../_lib/record-form";
import { signedUrl } from "../../_lib/safe-url";
import { OfficerDialog } from "./officer-dialog";

function term(r: CdaOfficer): string {
  return `${formatDate(r.term_start)} – ${r.term_end ? formatDate(r.term_end) : "present"}`;
}

const OFFICER_COLUMNS: RegisterColumn<CdaOfficer>[] = [
  {
    header: "Name",
    cell: (r) => (
      <div>
        <p className="font-medium">{r.name ?? r.member?.name ?? "—"}</p>
        {r.member && <p className="text-xs text-muted-foreground">Member{r.member.code ? ` ${r.member.code}` : ""}</p>}
      </div>
    ),
  },
  { header: "Sex", cell: (r) => labelOf(SEX_LABELS, r.sex) },
  {
    header: "Position",
    cell: (r) => (
      <div>
        <p>{labelOf(POSITION_LABELS, r.position)}</p>
        {(r.committee || r.position_title) && (
          <p className="text-xs text-muted-foreground">{[r.committee, r.position_title].filter(Boolean).join(" · ")}</p>
        )}
      </div>
    ),
  },
  { header: "Term", cell: term },
  { header: "Elected", cell: (r) => (r.election_date ? formatDate(r.election_date) : "—") },
  {
    header: "Mandatory trainings",
    cell: (r) => {
      const meta = TRAINING_COMPLIANCE_META[r.trainings.status] ?? { label: "Other", tone: "neutral" as const };
      return (
        <div className="space-y-1">
          <ToneBadge tone={meta.tone} label={`${meta.label} · ${r.trainings.completed} of ${r.trainings.required}`} />
          {r.trainings.missing.length > 0 && (
            <p className="text-xs text-muted-foreground">Missing: {r.trainings.missing.map(trainingKeyLabel).join(", ")}</p>
          )}
        </div>
      );
    },
  },
  { header: "Status", cell: (r) => labelOf(OFFICER_STATUS_LABELS, r.status) },
];

const TRAINING_COLUMNS: RegisterColumn<CdaTraining>[] = [
  { header: "Officer", cell: (r) => r.officer?.name ?? "—" },
  {
    header: "Training",
    cell: (r) => (
      <div>
        <p className="font-medium">{r.title}</p>
        <p className="text-xs text-muted-foreground">
          {[r.training_type, r.is_mandatory ? "Mandatory" : null, r.requirement_key ? trainingKeyLabel(r.requirement_key) : null].filter(Boolean).join(" · ") || "Optional"}
        </p>
      </div>
    ),
  },
  {
    header: "Provider",
    cell: (r) => (
      <div>
        <p>{r.provider ?? "—"}</p>
        {r.provider_accreditation_no && <p className="text-xs text-muted-foreground">Accreditation {r.provider_accreditation_no}</p>}
      </div>
    ),
  },
  { header: "Started", cell: (r) => (r.started_on ? formatDate(r.started_on) : "—") },
  { header: "Completed", cell: (r) => (r.completed_on ? formatDate(r.completed_on) : "—") },
  { header: "Hours", cell: (r) => asSent(r.hours), align: "right" },
  { header: "Certificate no.", cell: (r) => r.certificate_number ?? "—" },
  { header: "Status", cell: (r) => labelOf(TRAINING_STATUS_LABELS, r.status) },
];

function trainingFields(officers: CdaOfficer[]): RecordField[] {
  return [
    {
      key: "officer_id",
      label: "Officer",
      type: "select",
      required: true,
      options: officers.map((o) => ({ value: String(o.id), label: `${o.name ?? o.member?.name ?? "Officer"} (${labelOf(POSITION_LABELS, o.position)})` })),
    },
    { key: "title", label: "Training", type: "text", required: true },
    {
      key: "training_type",
      label: "Training type",
      type: "text",
      placeholder: "e.g. Seminar",
      help: "Up to 40 characters, such as seminar, workshop or online course.",
    },
    {
      key: "requirement_key",
      label: "Meets requirement",
      type: "text",
      placeholder: "e.g. basic_coop_course",
      help: "The training key from CDA settings that this training meets.",
    },
    { key: "is_mandatory", label: "Mandatory", type: "checkbox" },
    { key: "provider", label: "Provider", type: "text" },
    { key: "provider_accreditation_no", label: "Provider accreditation no.", type: "text" },
    { key: "started_on", label: "Started", type: "date" },
    { key: "completed_on", label: "Completed", type: "date" },
    { key: "hours", label: "Hours", type: "money", placeholder: "0.00" },
    { key: "certificate_number", label: "Certificate no.", type: "text" },
    { key: "status", label: "Status", type: "select", required: true, options: toOptions(TRAINING_STATUS_LABELS) },
    { key: "expires_on", label: "Expires", type: "date" },
    { key: "remarks", label: "Remarks", type: "textarea" },
  ];
}

function asTraining(values: RecordValues): CdaTrainingInput {
  return { ...(values as CdaTrainingInput), officer_id: values.officer_id === null ? undefined : Number(values.officer_id) };
}

/** The officers serving in the year and the trainings completed in it, each its own register. */
export function OfficerRegisters({ year, onChanged }: { year: number; onChanged: () => void }) {
  const officers = useApiResource(useCallback(() => cdaService.listOfficers({ year }), [year]));
  const trainings = useApiResource(useCallback(() => cdaService.listTrainings({ year }), [year]));
  const fields = useMemo(() => trainingFields(officers.data?.rows ?? []), [officers.data]);
  const attach = useAttachDocument(year);
  const changed = () => {
    officers.refetch();
    onChanged();
  };

  return (
    <Tabs defaultValue="officers">
      <TabsList>
        <TabsTrigger value="officers">Officers</TabsTrigger>
        <TabsTrigger value="trainings">Trainings</TabsTrigger>
      </TabsList>
      <TabsContent value="officers" className="pt-2">
        <RegisterTable<CdaOfficer>
          title={`Officers serving in ${year}`}
          description="An officer counts for a year when their term overlaps it."
          noun={["officer", "officers"]}
          resource={officers}
          endpoints={[`GET ${API_ENDPOINTS.CDA.OFFICERS}`]}
          columns={OFFICER_COLUMNS}
          permission="cda:manage_officers"
          onDelete={(id) => cdaService.deleteOfficer(id).then(onChanged)}
          renderForm={({ open, record, onOpenChange, submit }) => (
            <OfficerDialog
              officer={record}
              open={open}
              onOpenChange={onOpenChange}
              onSubmit={(input) =>
                submit(record ? cdaService.updateOfficer(record.id, input) : cdaService.createOfficer(input)).then(onChanged)
              }
            />
          )}
        />
      </TabsContent>
      <TabsContent value="trainings" className="pt-2">
        <RegisterTable<CdaTraining>
          title={`Trainings in ${year}`}
          description="Completed trainings with a requirement key count toward each officer's mandatory trainings."
          noun={["training", "trainings"]}
          resource={trainings}
          endpoints={[`GET ${API_ENDPOINTS.CDA.TRAININGS}`]}
          columns={TRAINING_COLUMNS}
          fields={fields}
          defaults={{ status: "completed", is_mandatory: "" }}
          permission="cda:manage_officers"
          file={{ label: "Certificate", accept: CDA_FILE_ACCEPT, onEdit: true }}
          onCreate={(v, file) => cdaService.createTraining(asTraining(v), file).then(changed)}
          onUpdate={(id, v, file) => cdaService.updateTraining(id, asTraining(v), file).then(changed)}
          onDelete={(id) => cdaService.deleteTraining(id).then(changed)}
          rowActions={(r) => {
            const url = signedUrl(r.certificate?.url);
            return (
              <>
                {url && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Open certificate"
                    nativeButton={false}
                    render={<a href={url} target="_blank" rel="noopener noreferrer" />}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                )}
                <AttachButton subject={{ type: "training", id: r.id, name: r.title }} onAttach={attach.open} />
              </>
            );
          }}
        />
        {attach.dialog}
      </TabsContent>
    </Tabs>
  );
}
