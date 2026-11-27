"use client";

import { useCallback } from "react";
import { useApiResource } from "@/hooks";
import { cicService } from "@/services";

export const CIC_SUBMISSION_ENDPOINTS = ["GET /cic/submissions"];

/** Every CIC submission, newest first. */
export function useCicSubmissions() {
  const fetcher = useCallback(async () => {
    const drain = await cicService.listAllSubmissions();
    const rows = [...drain.rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { ...drain, rows };
  }, []);
  return useApiResource(fetcher);
}
