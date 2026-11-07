"use client";

import { useCallback, useMemo } from "react";
import { FileText } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaOfficer, CdaTraining } from "@/types/cda";
import { ReportWorkspace } from "../_components/report-workspace";
import { RegisterTable, type RegisterColumn } from "../_components/register-table";
import { ToneBadge } from "../_components/tone-badge";
import type { RecordField } from "../_lib/record-form";

const OFFICER_FIELDS: RecordField[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "position", label: "Position", type: "text", required: true, placeholder: "e.g. Chairperson" },
  { key: "committee", label: "Committee", type: "text", placeholder: "e.g. Board of Directors, Audit" },
  { key: "term_start", label: "Term start", type: "date", required: true },
  { key: "term_end", label: "Term end", type: "date" },
  {
    key: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
  },
  { key: "required_training_hours", label: "Required training hours", type: "number" },
];

const OFFICER_COLUMNS: RegisterColumn<CdaOfficer>[] = [
  { header: "Name", cell: (r) => r.name },
  { header: "Position", cell: (r) => r.position },
  { header: "Committee", cell: (r) => r.committee || "—" },
  { header: "Term", cell: (r) => `${formatDate(r.term_start)} – ${r.term_end ? formatDate(r.term_end) : "present"}` },
  {
    header: "Training",
    cell: (r) => {
      const done = r.completed_training_hours >= r.required_training_hours;
      return (
        <ToneBadge
          tone={done ? "success" : "warning"}
          label={`${r.completed_training_hours} / ${r.required_training_hours} h`}
        />
      );
    },
  },
  {
    header: "Status",
    cell: (r) => <ToneBadge tone={r.status === "active" ? "success" : "neutral"} label={r.status === "active" ? "Active" : "Inactive"} />,
  },
];

const TRAINING_COLUMNS: RegisterColumn<CdaTraining>[] = [
  { header: "Officer", cell: (r) => r.officer_name ?? `#${r.officer_id}` },
  { header: "Training", cell: (r) => r.title },
  { header: "Provider", cell: (r) => r.provider || "—" },
  { header: "Date", cell: (r) => formatDate(r.date) },
  { header: "Hours", cell: (r) => r.hours, align: "right" },
];

function Registers() {
  const officers = useApiResource(useCallback(() => cdaService.listOfficers(), []));
  const trainings = useApiResource(useCallback(() => cdaService.listTrainings(), []));
  const officerOptions = useMemo(
    () => (officers.data?.rows ?? []).map((o) => ({ value: String(o.id), label: `${o.name} (${o.position})` })),
    [officers.data],
  );
  const trainingFields: RecordField[] = useMemo(
    () => [
      { key: "officer_id", label: "Officer", type: "select", required: true, options: officerOptions },
      { key: "title", label: "Training", type: "text", required: true },
      { key: "provider", label: "Provider", type: "text", placeholder: "e.g. CDA-accredited training provider" },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "hours", label: "Hours", type: "number", required: true },
    ],
    [officerOptions],
  );

  return (
    <Tabs defaultValue="officers">
      <TabsList>
        <TabsTrigger value="officers">Officers</TabsTrigger>
        <TabsTrigger value="trainings">Trainings</TabsTrigger>
      </TabsList>
      <TabsContent value="officers">
        <RegisterTable<CdaOfficer>
          title="Officers and committee members"
          noun={["officer", "officers"]}
          resource={officers}
          endpoints={[`GET ${API_ENDPOINTS.CDA.OFFICERS}`]}
          columns={OFFICER_COLUMNS}
          fields={OFFICER_FIELDS}
          permission="cda:manage_officers"
          onCreate={(v) => cdaService.createOfficer(v as Partial<CdaOfficer>)}
          onUpdate={(id, v) => cdaService.updateOfficer(id, v as Partial<CdaOfficer>)}
          onDelete={(id) => cdaService.deleteOfficer(id)}
        />
      </TabsContent>
      <TabsContent value="trainings">
        <RegisterTable<CdaTraining>
          title="Mandatory trainings"
          description="Completed hours count toward each officer's required training."
          noun={["training", "trainings"]}
          resource={trainings}
          endpoints={[`GET ${API_ENDPOINTS.CDA.TRAININGS}`]}
          columns={TRAINING_COLUMNS}
          fields={trainingFields}
          permission="cda:manage_officers"
          file={{ label: "Certificate", accept: "application/pdf,image/*" }}
          onCreate={(v, file) => cdaService.createTraining(v as Partial<CdaTraining>, file).then(officers.refetch)}
          onUpdate={(id, v) => cdaService.updateTraining(id, v as Partial<CdaTraining>).then(officers.refetch)}
          onDelete={(id) => cdaService.deleteTraining(id).then(officers.refetch)}
          rowActions={(r) =>
            r.certificate_url ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open certificate"
                nativeButton={false}
                render={<a href={r.certificate_url} target="_blank" rel="noreferrer" />}
              >
                <FileText className="h-4 w-4" />
              </Button>
            ) : null
          }
        />
      </TabsContent>
    </Tabs>
  );
}

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="Officers & Trainings">
      <ReportWorkspace type="officers">
        <Registers />
      </ReportWorkspace>
    </RouteGuard>
  );
}
