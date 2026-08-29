import { API_ENDPOINTS } from "@/config/api-endpoints";
import { api } from "@/lib/api-client";
import type {
  ImportErrorPageMeta,
  ImportFileKind,
  ImportRowIssue,
  ImportRunStatus,
  ProductMappingResponse,
} from "@/types/data-import";
import type { AxiosRequestConfig } from "axios";

/**
 * Client for the CSV migration importer.
 *
 * Two unwrapping rules apply here and getting them wrong is silent, so each
 * method says which it uses:
 *   - `api.get`    unwraps to `response.data.data` and DISCARDS `meta`.
 *   - `api.getRaw` keeps the whole envelope.
 * Both share a return type, so TypeScript will not warn when the wrong one
 * throws away the pagination you needed — see the note on `auditService.list`,
 * where exactly that produced a permanently-null `meta` and a page that
 * displayed its own row count as the total.
 */

export interface CreateRunFileInput {
  filename: string;
  size_bytes: number;
  sha256: string;
}

export interface CreateRunInput {
  branch_id: number;
  as_of_date?: string;
  files: Partial<Record<ImportFileKind, CreateRunFileInput>>;
}

/** The server chooses `chunk_size`; the client must use what it is told rather
 *  than its own default, and each file freezes the value its run opened with. */
export interface CreateRunResponse {
  run: ImportRunStatus;
  chunk_size: number;
}

export const dataImportService = {
  /** api.get — the envelope carries no meta worth keeping. */
  createRun: (input: CreateRunInput) =>
    api.post<CreateRunResponse>(API_ENDPOINTS.DATA_IMPORT.RUNS, input),

  /** Status poll. Server-clock `seconds_since_last_advance` lives here — never
   *  compute staleness from the client's own poll time. */
  status: (runId: number | string) =>
    api.get<ImportRunStatus>(API_ENDPOINTS.DATA_IMPORT.RUN(runId)),

  /** Discovery for a reattach when localStorage is gone (cleared browser, other
   *  device). Returns null when the coop has no open run. */
  activeRun: () =>
    api.get<ImportRunStatus | null>(API_ENDPOINTS.DATA_IMPORT.RUNS, {
      params: { active: 1 },
    }),

  /** One chunk. `config` carries `onUploadProgress` and an AbortSignal — the
   *  shared `api.upload` spreads config before setting headers, so no plumbing
   *  change was needed. 200 = already held (idempotent replay), 201 = stored,
   *  409 = a different file resumed into this session. */
  uploadChunk: (
    runId: number | string,
    kind: ImportFileKind,
    index: number,
    body: FormData,
    config?: AxiosRequestConfig
  ) =>
    api.upload<{ status: string; chunk_index: number }>(
      API_ENDPOINTS.DATA_IMPORT.CHUNK(runId, kind, index),
      body,
      config
    ),

  assemble: (runId: number | string) =>
    api.post<ImportRunStatus>(API_ENDPOINTS.DATA_IMPORT.ASSEMBLE(runId), {}),

  /** Cancel. Frees the coop to start a new run — run creation 409s while one is
   *  open, so without this an abandoned upload blocks every future import. */
  cancel: (runId: number | string) =>
    api.delete<ImportRunStatus>(API_ENDPOINTS.DATA_IMPORT.RUN(runId)),

  productMapping: (runId: number | string) =>
    api.get<ProductMappingResponse>(API_ENDPOINTS.DATA_IMPORT.PRODUCT_MAPPING(runId)),

  /** Every distinct CSV product string must be covered, blank cells included —
   *  the blank cohort is a real one and the server keys on `""`. */
  saveProductMapping: (runId: number | string, mapping: Record<string, number>) =>
    api.put<{ warnings: string[] }>(
      API_ENDPOINTS.DATA_IMPORT.PRODUCT_MAPPING(runId),
      { mapping }
    ),

  /** getRaw, NOT get — the caller needs `meta.total` for pagination and
   *  `meta.stats` for the grouped summary, and `api.get` would discard both. */
  errors: (runId: number | string, params: { page?: number; per_page?: number }) =>
    api.getRaw<{ data: ImportRowIssue[]; meta: ImportErrorPageMeta }>(
      API_ENDPOINTS.DATA_IMPORT.ERRORS(runId),
      { params }
    ),

  /** Server-generated, streamed. Deliberately not built client-side: the client
   *  holds only the page it happened to load, and a CSV built from that is a
   *  plausible-looking short file — the exact bug class this codebase has a
   *  rule about. */
  downloadErrorReport: (runId: number | string) =>
    api.download(API_ENDPOINTS.DATA_IMPORT.ERRORS_CSV(runId)),
};
