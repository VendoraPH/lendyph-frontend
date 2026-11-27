"use client";

import { useCallback, useMemo } from "react";
import { useApiResource, type ApiResource } from "@/hooks";
import { cicService } from "@/services";
import { buildRecordInputs, cicContext } from "@/lib/cic/records";
import { validateCsdf } from "@/lib/cic/validate";
import type { CicIssue, CicRecordInput } from "@/lib/cic/types";
import type { CicContractRecord, CicSettings, CicSubjectRecord } from "@/types/cic";

export interface CicRecordSet {
  settings: CicSettings;
  subjects: CicSubjectRecord[];
  contracts: CicContractRecord[];
  /** Subjects then contracts; an issue's `recordIndex` points into this. */
  inputs: CicRecordInput[];
  issues: CicIssue[];
  /** True when either list stopped short of every record. */
  truncated: boolean;
  total: number | null;
}

interface Loaded {
  settings: CicSettings;
  subjects: CicSubjectRecord[];
  contracts: CicContractRecord[];
  truncated: boolean;
  total: number | null;
}

export const CIC_RECORD_ENDPOINTS = ["GET /cic/settings", "GET /cic/subjects", "GET /cic/contracts"];

/**
 * The settings and every subject and contract record as of `referenceDate`,
 * validated in the browser with the same rules the file is built by.
 * Validation runs on the records as served, so a fix in Lendy shows after a
 * reload.
 */
export function useCicRecords(referenceDate: string): ApiResource<CicRecordSet> {
  const fetcher = useCallback(async (): Promise<Loaded> => {
    const filters = { reference_date: referenceDate };
    const [settings, subjects, contracts] = await Promise.all([
      cicService.getSettings(),
      cicService.listAllSubjects(filters),
      cicService.listAllContracts(filters),
    ]);
    const total =
      subjects.total === null || contracts.total === null ? null : subjects.total + contracts.total;
    return {
      settings,
      subjects: subjects.rows,
      contracts: contracts.rows,
      truncated: subjects.truncated || contracts.truncated,
      total,
    };
  }, [referenceDate]);
  const resource = useApiResource<Loaded>(fetcher);
  const { data } = resource;

  const set = useMemo<CicRecordSet | null>(() => {
    if (!data) return null;
    const inputs = buildRecordInputs(data.subjects, data.contracts);
    const issues = validateCsdf(inputs, cicContext(data.settings, referenceDate));
    return { ...data, inputs, issues };
  }, [data, referenceDate]);

  return { ...resource, data: set };
}
