/**
 * Automated due-date reminders.
 *
 * The endpoints are `API_ENDPOINTS.REMINDERS`, served by the reminders API
 * (Phase 2, slice R2) against the contract in `@/types/reminder`. Until it is
 * deployed every screen shows "Not connected yet". Nothing here sends to a
 * member: the engine runs on log-only drivers, and the screens show test mode.
 */

import { api } from "@/lib/api-client";
import { MAX_PER_PAGE } from "@/lib/paginate";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type { PaginatedResponse } from "@/types";
import type {
  BorrowerNotificationPreferences,
  BorrowerNotificationPreferencesUpdate,
  LoanReminderSummary,
  ManualReminderPreview,
  ManualReminderRequest,
  ManualReminderResult,
  PauseRequest,
  ReminderDashboard,
  ReminderDashboardFilters,
  ReminderHistoryFilters,
  ReminderListFilters,
  ReminderMessage,
  ReminderPause,
  ReminderQueueItem,
  ReminderRule,
  ReminderRuleInput,
  ReminderSettings,
  ReminderSettingsUpdate,
  ReminderTemplate,
  ReminderTemplateInput,
  ResumeRequest,
  TemplatePreview,
  TemplatePreviewRequest,
} from "@/types/reminder";

const R = API_ENDPOINTS.REMINDERS;

export const reminderService = {
  getDashboard: (filters: ReminderDashboardFilters = {}) =>
    api.get<ReminderDashboard>(R.DASHBOARD, { params: filters }),

  // Rules and templates are short, unpaginated lists (a handful per tenant).
  listRules: () => api.get<ReminderRule[]>(R.RULES),
  createRule: (data: ReminderRuleInput) => api.post<ReminderRule>(R.RULES, data),
  updateRule: (id: number, data: ReminderRuleInput) => api.put<ReminderRule>(R.RULE(id), data),
  deactivateRule: (id: number) => api.post<ReminderRule>(R.RULE_DEACTIVATE(id)),

  listTemplates: () => api.get<ReminderTemplate[]>(R.TEMPLATES),
  createTemplate: (data: ReminderTemplateInput) =>
    api.post<ReminderTemplate>(R.TEMPLATES, data),
  updateTemplate: (id: number, data: ReminderTemplateInput) =>
    api.put<ReminderTemplate>(R.TEMPLATE(id), data),
  previewTemplate: (data: TemplatePreviewRequest) =>
    api.post<TemplatePreview>(R.TEMPLATE_PREVIEW, data),

  /**
   * Queue and history are Laravel paginators (`{ data, links, meta }`), read
   * with `getRaw` so `meta.total` and `meta.stats` (per-status counts for the
   * tabs) survive. `per_page` goes first so a caller can still override it.
   */
  listQueue: (filters: ReminderListFilters = {}) =>
    api.getRaw<PaginatedResponse<ReminderQueueItem>>(R.QUEUE, {
      params: { per_page: MAX_PER_PAGE, ...filters },
    }),
  listHistory: (filters: ReminderHistoryFilters = {}) =>
    api.getRaw<PaginatedResponse<ReminderMessage>>(R.HISTORY, {
      params: { per_page: MAX_PER_PAGE, ...filters },
    }),
  getMessage: (id: number) => api.get<ReminderMessage>(R.HISTORY_DETAIL(id)),

  getLoanReminders: (loanId: number) => api.get<LoanReminderSummary>(R.LOAN(loanId)),

  previewManual: (data: ManualReminderRequest) =>
    api.post<ManualReminderPreview>(R.MANUAL_PREVIEW, data),
  sendManual: (data: ManualReminderRequest) =>
    api.post<ManualReminderResult>(R.MANUAL_SEND, data),

  listPauses: () => api.get<ReminderPause[]>(R.PAUSES),
  pause: (data: PauseRequest) => api.post<ReminderPause>(R.PAUSE, data),
  resume: (data: ResumeRequest) => api.post<null>(R.RESUME, data),

  getSettings: () => api.get<ReminderSettings>(R.SETTINGS),
  updateSettings: (data: ReminderSettingsUpdate) =>
    api.put<ReminderSettings>(R.SETTINGS, data),

  getBorrowerPreferences: (borrowerId: number) =>
    api.get<BorrowerNotificationPreferences>(R.BORROWER_PREFERENCES(borrowerId)),
  updateBorrowerPreferences: (
    borrowerId: number,
    data: BorrowerNotificationPreferencesUpdate,
  ) =>
    api.put<BorrowerNotificationPreferences>(R.BORROWER_PREFERENCES(borrowerId), data),
};
