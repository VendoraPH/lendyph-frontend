export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    /**
     * Global per-status row counts, keyed by status (e.g. `active`, `pending`).
     * Unaffected by the request's own `status`/`search` filters, so a list screen
     * can render its status tabs from one request. Only some endpoints send it.
     */
    stats?: Record<string, number>;
  };
}
